'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'
import ThreadComunicado from '@/components/shared/ThreadComunicado'
import { sanitizarNomeArquivo } from '@/lib/storage/sanitizarNomeArquivo'

type Comunicado = {
  id: string
  titulo: string
  tipo: string
  status: string
  requer_resposta: boolean
  created_at: string
}

const tipoLabel: Record<string, string> = {
  aviso: 'Aviso',
  solicitacao_documento: 'Solicitação de Documento',
}

const tipoBadge: Record<string, string> = {
  aviso: 'bg-blue-50 text-blue-700 border border-blue-200',
  solicitacao_documento: 'bg-lime/15 text-[#4f8f2a] border border-lime/40',
}

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  respondido: 'Respondido',
  concluido: 'Concluído',
}

const statusBadge: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700 border border-amber-200',
  respondido: 'bg-blue-50 text-blue-700 border border-blue-200',
  concluido: 'bg-[#eef7e0] text-[#4f8f2a] border border-[#c8e2a1]',
}

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-white px-2 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

// created_at vem em UTC do banco (timestamptz); precisa converter pro fuso
// de Brasília explicitamente, senão o dia exibido pode variar conforme o
// fuso do navegador — mesmo cuidado já usado em formatarDataHora (histórico).
function formatarData(data: string) {
  const dataObj = new Date(data)
  const dataFormatada = dataObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const horaFormatada = dataObj.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dataFormatada} às ${horaFormatada}`
}

// Função pura fora do componente — só busca e devolve os dados, sem tocar em
// estado. Quem chama (o efeito de carregamento inicial e o handleSubmit
// depois de enviar um comunicado novo) decide o que fazer com o resultado.
// Isso evita chamar setState através de uma função "externa" ao efeito, que
// é o que o eslint (react-hooks/set-state-in-effect) reclama.
async function buscarComunicados(clienteId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('comunicados')
    .select('id, titulo, tipo, status, requer_resposta, created_at')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })

  return data ?? []
}

export default function ComunicadosCliente({
  clienteId,
  nomeCliente,
}: {
  clienteId: string
  nomeCliente: string
}) {
  const supabase = createClient()

  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  const [tipo, setTipo] = useState<'aviso' | 'solicitacao_documento'>('aviso')
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [apenasAviso, setApenasAviso] = useState(false)

  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    async function carregar() {
      const comunicados = await buscarComunicados(clienteId)
      setComunicados(comunicados)
      setCarregando(false)
    }

    carregar()
  }, [clienteId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setEnviando(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // "Apenas aviso" só existe pro tipo 'aviso' — Solicitação de Documento
    // sempre exige resposta do cliente. Nasce 'pendente' de qualquer jeito
    // (não mais 'concluido' direto): o cliente precisa dar ciência ("Estou
    // ciente deste aviso", no ThreadComunicado) pra conversa fechar sozinha
    // — requer_resposta=false só marca que não é preciso ele ESCREVER nada,
    // mas ainda precisa confirmar que viu.
    const apenasAvisoAtivo = tipo === 'aviso' && apenasAviso

    const { data: comunicado, error: insertError } = await supabase
      .from('comunicados')
      .insert({
        cliente_id: clienteId,
        tipo,
        titulo,
        mensagem,
        status: 'pendente',
        requer_resposta: !apenasAvisoAtivo,
        enviado_por: user?.id ?? null,
      })
      .select('id')
      .single()

    if (insertError || !comunicado) {
      setError('Não foi possível enviar o comunicado. Tente novamente.')
      setEnviando(false)
      return
    }

    // O comunicado é o início de uma conversa (thread): a mensagem original
    // vira automaticamente a primeira entrada em mensagens_comunicado —
    // mesmo critério usado na migração dos comunicados antigos.
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', user.id).single()
      const autorNome = profile?.nome ?? 'Opção Contábil'

      await supabase.from('mensagens_comunicado').insert({
        comunicado_id: comunicado.id,
        autor_tipo: 'admin',
        autor_id: user.id,
        autor_nome: autorNome,
        mensagem,
      })

      // Anexo opcional já na criação: vira uma segunda mensagem na mesma
      // thread (mesmo padrão do ThreadComunicado — 1 arquivo = 1 mensagem,
      // já que documento_id é 1:1 com mensagem), em vez de sobrescrever a
      // mensagem de texto que acabou de ser criada.
      if (arquivo) {
        const caminhoArquivo = `${clienteId}/${Date.now()}-${sanitizarNomeArquivo(arquivo.name)}`

        const { error: uploadError } = await supabase.storage
          .from('documentos-clientes')
          .upload(caminhoArquivo, arquivo)

        if (uploadError) {
          console.error('[ComunicadosCliente] Erro ao enviar anexo pro Storage:', uploadError)
          setError(`Comunicado enviado, mas o anexo falhou: ${uploadError.message}`)
        } else {
          const { data: documento, error: documentoError } = await supabase
            .from('documentos_clientes')
            .insert({
              cliente_id: clienteId,
              comunicado_id: comunicado.id,
              nome_arquivo: arquivo.name,
              tipo: arquivo.name.split('.').pop() ?? '',
              caminho_arquivo: caminhoArquivo,
            })
            .select('id')
            .single()

          if (documentoError || !documento) {
            console.error('[ComunicadosCliente] Erro ao vincular anexo à conversa:', documentoError)
            setError('Comunicado enviado, mas houve um erro ao vincular o anexo à conversa.')
          } else {
            await supabase.from('mensagens_comunicado').insert({
              comunicado_id: comunicado.id,
              autor_tipo: 'admin',
              autor_id: user.id,
              autor_nome: autorNome,
              mensagem: '',
              documento_id: documento.id,
            })
          }
        }
      }
    }

    registrarHistoricoAtividade({
      acao: 'enviou_comunicado',
      entidade: 'comunicado',
      entidadeId: comunicado.id,
      entidadeNome: `${titulo} — ${nomeCliente}`,
    })

    setTitulo('')
    setMensagem('')
    setTipo('aviso')
    setArquivo(null)
    setApenasAviso(false)
    setEnviando(false)

    const comunicadosAtualizados = await buscarComunicados(clienteId)
    setComunicados(comunicadosAtualizados)
  }

  return (
    <div className="mt-10 border-t border-rule pt-8">
      <h2 className="mb-4 font-display text-lg font-semibold text-navy">Comunicados</h2>

      {carregando ? (
        <p className="mb-6 text-sm text-navy-soft">Carregando...</p>
      ) : comunicados.length === 0 ? (
        <p className="mb-6 text-sm text-navy-soft">Nenhum comunicado enviado ainda.</p>
      ) : (
        <ul className="mb-6 flex flex-col gap-2">
          {comunicados.map((comunicado) => {
            const aberto = expandidoId === comunicado.id
            return (
              <li key={comunicado.id} className="rounded-md border border-rule bg-white px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-navy">{comunicado.titulo}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${
                        tipoBadge[comunicado.tipo] ?? 'border border-rule bg-paper-dim text-navy-soft'
                      }`}
                    >
                      {tipoLabel[comunicado.tipo] ?? comunicado.tipo}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${
                        statusBadge[comunicado.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                      }`}
                    >
                      {statusLabel[comunicado.status] ?? comunicado.status}
                    </span>
                    <span className="font-mono text-[11px] text-navy-soft">
                      {formatarData(comunicado.created_at)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandidoId(aberto ? null : comunicado.id)}
                      className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
                    >
                      {aberto ? 'Ocultar conversa' : 'Ver conversa'}
                    </button>
                  </div>
                </div>

                {aberto && (
                  <div className="mt-3 border-t border-rule pt-3">
                    <ThreadComunicado
                      comunicadoId={comunicado.id}
                      clienteId={clienteId}
                      tipoComunicado={comunicado.tipo === 'solicitacao_documento' ? 'solicitacao_documento' : 'aviso'}
                      autorTipo="admin"
                      tituloComunicado={comunicado.titulo}
                      nomeCliente={nomeCliente}
                      statusAtual={comunicado.status}
                      requerResposta={comunicado.requer_resposta}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-rule bg-paper-dim p-4">
        <div>
          <label htmlFor="comunicadoTipo" className={labelClasses}>
            Tipo
          </label>
          <select
            id="comunicadoTipo"
            value={tipo}
            onChange={(e) => {
              const novoTipo = e.target.value as 'aviso' | 'solicitacao_documento'
              setTipo(novoTipo)
              // Checkbox só existe pro tipo 'aviso' — some da tela ao trocar
              // pra Solicitação de Documento, então destrava o estado junto,
              // pra não ficar marcado "escondido" se a pessoa voltar pra
              // 'aviso' depois sem querer.
              if (novoTipo !== 'aviso') setApenasAviso(false)
            }}
            className={inputClasses}
          >
            <option value="aviso">Aviso</option>
            <option value="solicitacao_documento">Solicitação de Documento</option>
          </select>
        </div>

        {tipo === 'aviso' && (
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={apenasAviso}
              onChange={(e) => setApenasAviso(e.target.checked)}
              className="h-4 w-4 accent-lime"
            />
            Apenas aviso — não requer resposta do cliente
          </label>
        )}

        <div>
          <label htmlFor="comunicadoTitulo" className={labelClasses}>
            Título
          </label>
          <input
            id="comunicadoTitulo"
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="comunicadoMensagem" className={labelClasses}>
            Mensagem
          </label>
          <textarea
            id="comunicadoMensagem"
            required
            rows={3}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </div>

        {tipo === 'solicitacao_documento' && (
          <div>
            <label htmlFor="comunicadoAnexo" className={labelClasses}>
              Anexo (opcional)
            </label>
            <input
              id="comunicadoAnexo"
              type="file"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="block text-sm text-charcoal file:mr-3 file:rounded-[3px] file:border-[1.3px] file:border-navy file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy file:transition-colors file:duration-200 hover:file:bg-navy hover:file:text-paper"
            />
            {arquivo && <p className="mt-1.5 text-xs text-navy-soft">📎 {arquivo.name}</p>}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright disabled:opacity-60"
        >
          {enviando ? 'Enviando...' : 'Enviar comunicado'}
        </button>
      </form>
    </div>
  )
}

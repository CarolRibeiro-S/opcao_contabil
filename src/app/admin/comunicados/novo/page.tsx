'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'

// Mesmo padrão de lotes já usado no Envio Mensal (EnvioMensalConfirmacao.tsx):
// o front divide os clientes selecionados em lotes pequenos e chama a rota
// uma vez por lote, sequencialmente, mostrando progresso — evita uma única
// requisição gigante e permite ver o andamento em tempo real.
const TAMANHO_LOTE = 10

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

type ClienteOption = { id: string; nome_empresa: string; segmento: string | null }

type Falha = { clienteId: string; nomeCliente: string; motivo: string }

type Resultado = {
  comunicadosCriados: number
  emailsEnviados: number
  pulados: number
  falhas: Falha[]
}

type Progresso = { loteAtual: number; totalLotes: number; clientesProcessados: number }

function dividirEmLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho))
  }
  return lotes
}

export default function NovoComunicadoMassaPage() {
  const supabase = createClient()

  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [carregandoClientes, setCarregandoClientes] = useState(true)

  const [tipo, setTipo] = useState<'aviso' | 'solicitacao_documento'>('aviso')
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [apenasAviso, setApenasAviso] = useState(false)

  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function carregarClientes() {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome_empresa, segmento')
        .order('nome_empresa', { ascending: true })

      setClientes(data ?? [])
      setCarregandoClientes(false)
    }

    carregarClientes()
  }, [supabase])

  const termo = busca.trim().toLowerCase()
  const clientesFiltrados = useMemo(() => {
    if (!termo) return clientes
    return clientes.filter(
      (cliente) =>
        cliente.nome_empresa.toLowerCase().includes(termo) ||
        (cliente.segmento ?? '').toLowerCase().includes(termo)
    )
  }, [clientes, termo])

  const todosFiltradosSelecionados =
    clientesFiltrados.length > 0 && clientesFiltrados.every((cliente) => selecionados.has(cliente.id))

  function alternarCliente(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) {
        novo.delete(id)
      } else {
        novo.add(id)
      }
      return novo
    })
  }

  function alternarTodosFiltrados() {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (todosFiltradosSelecionados) {
        for (const cliente of clientesFiltrados) novo.delete(cliente.id)
      } else {
        for (const cliente of clientesFiltrados) novo.add(cliente.id)
      }
      return novo
    })
  }

  async function enviarLote(clienteIds: string[]) {
    // Upload direto do navegador pro Storage — mesmo padrão já usado no
    // ThreadComunicado — uma cópia por cliente deste lote, já que o caminho
    // é por cliente_id. Se o upload de um cliente falhar, os outros do lote
    // continuam normalmente; esse cliente só não recebe o anexo (o
    // comunicado dele ainda é criado, só sem o arquivo vinculado).
    const anexos: { cliente_id: string; nome_arquivo: string; caminho_arquivo: string; tipo_arquivo: string }[] = []

    if (arquivo) {
      const extensao = arquivo.name.split('.').pop() ?? ''

      await Promise.all(
        clienteIds.map(async (clienteId) => {
          const caminhoArquivo = `${clienteId}/${Date.now()}-${arquivo.name}`

          const { error: uploadError } = await supabase.storage
            .from('documentos-clientes')
            .upload(caminhoArquivo, arquivo)

          if (uploadError) {
            console.error(`[NovoComunicadoMassa] Erro ao enviar anexo pro cliente ${clienteId}:`, uploadError)
            return
          }

          anexos.push({
            cliente_id: clienteId,
            nome_arquivo: arquivo.name,
            caminho_arquivo: caminhoArquivo,
            tipo_arquivo: extensao,
          })
        })
      )
    }

    // "Apenas aviso" só existe pro tipo 'aviso' — Solicitação de Documento
    // sempre exige resposta do cliente, então cada comunicado nasce
    // 'pendente' normalmente.
    const apenasAvisoAtivo = tipo === 'aviso' && apenasAviso

    const resposta = await fetch('/api/comunicados/enviar-massa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo,
        titulo,
        mensagem,
        cliente_ids: clienteIds,
        anexos,
        requer_resposta: !apenasAvisoAtivo,
      }),
    })

    const dados = await resposta.json().catch(() => null)

    if (!resposta.ok || !dados) {
      const motivo = typeof dados?.error === 'string' ? dados.error : 'Falha ao processar este lote.'
      const nomePorId = new Map(clientes.map((cliente) => [cliente.id, cliente.nome_empresa]))
      return {
        comunicadosCriados: 0,
        emailsEnviados: 0,
        pulados: 0,
        falhas: clienteIds.map((clienteId) => ({
          clienteId,
          nomeCliente: nomePorId.get(clienteId) ?? 'Cliente',
          motivo,
        })),
      } satisfies Resultado
    }

    return dados as Resultado
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (selecionados.size === 0) {
      setError('Selecione pelo menos um cliente.')
      return
    }

    const confirmado = window.confirm(
      `Enviar este comunicado para ${selecionados.size} cliente(s) agora? Essa ação não pode ser desfeita.`
    )
    if (!confirmado) return

    setEnviando(true)
    setResultado(null)

    const idsSelecionados = Array.from(selecionados)
    const lotes = dividirEmLotes(idsSelecionados, TAMANHO_LOTE)

    const acumulado: Resultado = { comunicadosCriados: 0, emailsEnviados: 0, pulados: 0, falhas: [] }
    let clientesProcessados = 0

    for (let i = 0; i < lotes.length; i++) {
      setProgresso({ loteAtual: i + 1, totalLotes: lotes.length, clientesProcessados })

      const resultadoLote = await enviarLote(lotes[i])
      acumulado.comunicadosCriados += resultadoLote.comunicadosCriados
      acumulado.emailsEnviados += resultadoLote.emailsEnviados
      acumulado.pulados += resultadoLote.pulados
      acumulado.falhas.push(...resultadoLote.falhas)

      clientesProcessados += lotes[i].length
      setProgresso({ loteAtual: i + 1, totalLotes: lotes.length, clientesProcessados })
    }

    // Uma única entrada resumida no histórico pro disparo inteiro, em vez de
    // uma por cliente (que poluiria o histórico com dezenas de linhas
    // idênticas). Não existe uma única "entidade" natural pra um disparo em
    // massa, então geramos um id novo só pra essa entrada de log.
    registrarHistoricoAtividade({
      acao: 'enviou_comunicado',
      entidade: 'comunicado',
      entidadeId: crypto.randomUUID(),
      entidadeNome: titulo,
      detalhes: `Disparo em massa: ${acumulado.comunicadosCriados} comunicado(s) criado(s), ${acumulado.emailsEnviados} e-mail(s) enviados, ${acumulado.pulados} sem e-mail cadastrado${
        acumulado.falhas.length > 0 ? `, ${acumulado.falhas.length} falha(s)` : ''
      }.`,
    })

    setResultado(acumulado)
    setProgresso(null)
    setEnviando(false)
  }

  if (resultado) {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-2 font-display text-2xl font-semibold text-navy">Disparo concluído</h1>
        <p className="mb-6 text-sm text-navy-soft">
          {resultado.comunicadosCriados} comunicado(s) criado(s) · {resultado.emailsEnviados} e-mail(s) enviado(s)
          {resultado.pulados > 0 && ` · ${resultado.pulados} sem e-mail cadastrado`}
        </p>

        {resultado.falhas.length > 0 && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="mb-2 text-sm font-semibold text-red-800">Falhas:</p>
            <ul className="flex flex-col gap-1">
              {resultado.falhas.map((falha, index) => (
                <li key={`${falha.clienteId}-${index}`} className="text-sm text-red-700">
                  {falha.nomeCliente}: {falha.motivo}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href="/admin/comunicados"
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)]"
        >
          Ver Comunicados
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/comunicados"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-navy"
      >
        ← Voltar
      </Link>

      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">Novo Comunicado em Massa</h1>
      <p className="mb-8 text-sm text-navy-soft">
        Escreva a mensagem uma vez e escolha para quais clientes ela vai. Cada cliente recebe o comunicado no
        Portal e, se tiver e-mail cadastrado, também por e-mail.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="tipo" className={labelClasses}>
            Tipo
          </label>
          <select
            id="tipo"
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
          <label htmlFor="titulo" className={labelClasses}>
            Título
          </label>
          <input
            id="titulo"
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="mensagem" className={labelClasses}>
            Mensagem
          </label>
          <textarea
            id="mensagem"
            rows={5}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </div>

        {tipo === 'solicitacao_documento' && (
          <div>
            <label htmlFor="anexo" className={labelClasses}>
              Anexo (opcional)
            </label>
            <input
              id="anexo"
              type="file"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="block text-sm text-charcoal file:mr-3 file:rounded-[3px] file:border-[1.3px] file:border-navy file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy file:transition-colors file:duration-200 hover:file:bg-navy hover:file:text-paper"
            />
            {arquivo && (
              <p className="mt-1.5 text-xs text-navy-soft">
                📎 {arquivo.name} — enviado para cada cliente selecionado individualmente
              </p>
            )}
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={labelClasses}>Clientes</label>
            <span className="font-mono text-[11px] text-navy-soft">
              {selecionados.size} selecionado(s)
            </span>
          </div>

          <input
            type="search"
            placeholder="Buscar por empresa ou segmento..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="mb-3 w-full rounded-[3px] border border-rule bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors duration-200 focus:border-lime"
          />

          <div className="overflow-hidden rounded-lg border border-rule bg-white">
            <label className="flex items-center gap-2.5 border-b border-rule bg-paper-dim px-3.5 py-2.5 text-sm font-medium text-navy">
              <input
                type="checkbox"
                checked={todosFiltradosSelecionados}
                onChange={alternarTodosFiltrados}
                disabled={clientesFiltrados.length === 0}
                className="h-4 w-4 accent-lime"
              />
              Selecionar todos os {clientesFiltrados.length} filtrados
            </label>

            <div className="max-h-72 overflow-y-auto">
              {carregandoClientes ? (
                <p className="px-3.5 py-3 text-sm text-navy-soft">Carregando clientes...</p>
              ) : clientesFiltrados.length === 0 ? (
                <p className="px-3.5 py-3 text-sm text-navy-soft">Nenhum cliente encontrado para essa busca.</p>
              ) : (
                <ul className="divide-y divide-rule">
                  {clientesFiltrados.map((cliente) => (
                    <li key={cliente.id}>
                      <label className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-charcoal transition-colors duration-200 hover:bg-paper-dim">
                        <input
                          type="checkbox"
                          checked={selecionados.has(cliente.id)}
                          onChange={() => alternarCliente(cliente.id)}
                          className="h-4 w-4 shrink-0 accent-lime"
                        />
                        <span className="min-w-0 flex-1 truncate">{cliente.nome_empresa}</span>
                        {cliente.segmento && (
                          <span className="shrink-0 font-mono text-[11px] text-navy-soft">
                            {cliente.segmento}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {progresso && (
          <div className="max-w-md">
            <p className="mb-2 text-sm text-navy-soft">
              Enviando lote {progresso.loteAtual} de {progresso.totalLotes} — {progresso.clientesProcessados} de{' '}
              {selecionados.size} cliente(s) processados
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-paper-dim">
              <div
                className="h-2 rounded-full bg-lime transition-[width] duration-300 ease-out"
                style={{ width: `${Math.round((progresso.clientesProcessados / selecionados.size) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={enviando || selecionados.size === 0}
          className="mt-2 inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando
            ? progresso
              ? `Enviando lote ${progresso.loteAtual} de ${progresso.totalLotes}...`
              : 'Enviando...'
            : `Enviar para ${selecionados.size} cliente${selecionados.size === 1 ? '' : 's'}`}
        </button>
      </form>
    </div>
  )
}

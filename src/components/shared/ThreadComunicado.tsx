'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'
import { sanitizarNomeArquivo } from '@/lib/storage/sanitizarNomeArquivo'

type Mensagem = {
  id: string
  autor_tipo: 'admin' | 'cliente'
  autor_nome: string
  mensagem: string
  documento_id: string | null
  created_at: string
  documentos_clientes: { nome_arquivo: string; caminho_arquivo: string } | null
}

const inputClasses =
  'w-full rounded-[3px] border border-rule bg-white px-3 py-2.5 font-body text-sm text-charcoal outline-none transition-colors duration-200 focus:border-lime'

// created_at vem em UTC do banco (timestamptz); precisa converter pro fuso
// de Brasília explicitamente — mesmo cuidado já usado em outras listagens
// que exibem timestamps (histórico, portal, comunicados).
function formatarDataHora(iso: string) {
  const data = new Date(iso)
  const dataFormatada = data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const horaFormatada = data.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dataFormatada} às ${horaFormatada}`
}

async function buscarMensagens(supabase: ReturnType<typeof createClient>, comunicadoId: string) {
  const { data } = await supabase
    .from('mensagens_comunicado')
    .select('id, autor_tipo, autor_nome, mensagem, documento_id, created_at, documentos_clientes(nome_arquivo, caminho_arquivo)')
    .eq('comunicado_id', comunicadoId)
    .order('created_at', { ascending: true })
    .returns<Mensagem[]>()

  return data ?? []
}

export default function ThreadComunicado({
  comunicadoId,
  clienteId,
  tipoComunicado,
  autorTipo,
  tituloComunicado,
  nomeCliente,
  statusAtual,
  requerResposta,
  visualizadoPeloClienteEm,
}: {
  comunicadoId: string
  clienteId: string
  tipoComunicado: 'aviso' | 'solicitacao_documento'
  autorTipo: 'admin' | 'cliente'
  tituloComunicado: string
  nomeCliente: string
  statusAtual: string
  requerResposta: boolean
  visualizadoPeloClienteEm?: string | null
}) {
  const router = useRouter()
  const supabase = createClient()

  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState(statusAtual)
  const [concluindo, setConcluindo] = useState(false)

  const [texto, setTexto] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const listaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const dados = await buscarMensagens(supabase, comunicadoId)
      setMensagens(dados)
      setCarregando(false)

      // Admin abrindo a conversa = "visto". Roda assim que a lista carrega,
      // sem esperar nenhuma ação — e não fica restrito a status='respondido'
      // (abrir qualquer thread já marca como vista). router.refresh() joga
      // esse comunicado pra fora do banner de "respostas não vistas" no
      // layout do Admin.
      if (autorTipo === 'admin') {
        const { error: vistoError } = await supabase
          .from('comunicados')
          .update({ visto_em: new Date().toISOString() })
          .eq('id', comunicadoId)

        if (vistoError) {
          console.error('[ThreadComunicado] Erro ao marcar conversa como vista:', vistoError)
        } else {
          router.refresh()
        }
      }

      // Espelha a lógica acima pro lado do cliente: abrir a conversa (esse
      // componente só monta quando o cliente clica "Ver conversa" no
      // ComunicadoThread, que fica fechado por padrão) marca "visualizado",
      // sem exigir nenhuma ação — mesmo padrão de PagamentoCobranca.tsx. Só
      // marca uma vez (se já tem valor, não sobrescreve).
      if (autorTipo === 'cliente' && !visualizadoPeloClienteEm) {
        const { error: visualizadoError } = await supabase
          .from('comunicados')
          .update({ visualizado_pelo_cliente_em: new Date().toISOString() })
          .eq('id', comunicadoId)

        if (visualizadoError) {
          console.error('[ThreadComunicado] Erro ao marcar comunicado como visualizado:', visualizadoError)
        } else {
          router.refresh()
        }
      }
    }

    carregar()
    // supabase/router são recriados a cada render mas apontam sempre pro
    // mesmo projeto/instância — só comunicadoId deve disparar uma nova busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comunicadoId])

  // Rola pro final (mensagem mais recente) sempre que a lista muda — tanto
  // na abertura/carregamento inicial quanto depois de enviar uma mensagem
  // nova. Não depende de "busca" de propósito: filtrar a conversa não deve
  // arrastar a rolagem de volta pro fim enquanto a pessoa está procurando
  // algo no meio dela.
  useEffect(() => {
    if (listaRef.current) {
      listaRef.current.scrollTop = listaRef.current.scrollHeight
    }
  }, [mensagens])

  // Aviso do tipo "apenas informativo" (checkbox marcado na criação): o
  // cliente não escreve nada, só confirma ciência — por isso a caixa de
  // resposta inteira (texto + anexo) fica escondida pro lado dele nesse
  // cenário específico.
  const avisoInformativo = tipoComunicado === 'aviso' && !requerResposta

  const mensagensFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return mensagens

    return mensagens.filter(
      (msg) => msg.mensagem.toLowerCase().includes(termo) || msg.autor_nome.toLowerCase().includes(termo)
    )
  }, [mensagens, busca])

  async function baixarAnexo(caminhoArquivo: string) {
    const { data } = await supabase.storage.from('documentos-clientes').createSignedUrl(caminhoArquivo, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  // Compartilhado pelos dois botões que fecham a conversa: "Marcar conversa
  // como concluída" (admin, qualquer comunicado) e "Estou ciente deste
  // aviso" (cliente, só em avisos com requer_resposta=false) — a ação é
  // idêntica nos dois casos, só muda quem vê o botão e o texto dele. Sem
  // reabertura por enquanto (mantém simples). Atualiza o estado local na
  // hora, sem precisar recarregar a página, e chama router.refresh() pra
  // badges de status em outros lugares da tela (lista de comunicados, cards
  // do Dashboard, banner de respostas não vistas) também ficarem em dia.
  async function handleConcluir() {
    setConcluindo(true)
    setError('')

    const { error: statusError } = await supabase
      .from('comunicados')
      .update({ status: 'concluido' })
      .eq('id', comunicadoId)

    if (statusError) {
      console.error('[ThreadComunicado] Erro ao marcar conversa como concluída:', statusError)
      setError('Não foi possível marcar a conversa como concluída. Tente novamente.')
      setConcluindo(false)
      return
    }

    // Cliente confirmando ciência de um aviso informativo (não o admin
    // marcando concluído): registra uma mensagem de sistema na própria
    // thread, pra ficar claro pro admin — ao reabrir a conversa depois —
    // que foi uma confirmação de leitura, não uma resposta qualquer.
    // Opcional por natureza: se falhar, não impede a conclusão em si.
    if (autorTipo === 'cliente') {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { error: mensagemError } = await supabase.from('mensagens_comunicado').insert({
          comunicado_id: comunicadoId,
          autor_tipo: 'cliente',
          autor_id: user.id,
          autor_nome: nomeCliente,
          mensagem: 'Cliente confirmou ciência deste aviso.',
        })

        if (mensagemError) {
          console.error('[ThreadComunicado] Erro ao registrar mensagem de ciência:', mensagemError)
        } else {
          const dados = await buscarMensagens(supabase, comunicadoId)
          setMensagens(dados)
        }
      }
    }

    setStatus('concluido')
    setConcluindo(false)
    router.refresh()
  }

  async function handleEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const texteLimpo = texto.trim()
    if (!texteLimpo && arquivos.length === 0) {
      setError('Escreva uma mensagem ou anexe um arquivo.')
      return
    }

    setEnviando(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Sessão expirada. Atualize a página e faça login novamente.')
      setEnviando(false)
      return
    }

    // Guardado numa const separada: o TypeScript não propaga o "if (!user)
    // return" acima pra dentro da função aninhada abaixo, mesmo sendo um
    // const capturado por closure — limitação conhecida da análise de fluxo.
    const userId = user.id

    const { data: profile } = await supabase.from('profiles').select('nome').eq('id', userId).single()
    const autorNome = profile?.nome ?? (autorTipo === 'cliente' ? nomeCliente : 'Opção Contábil')

    // Cria uma linha em mensagens_comunicado e dispara o aviso por e-mail
    // (não-bloqueante — a mensagem já está salva, o e-mail é um bônus).
    // Usado tanto pro caso "só texto" quanto uma vez por arquivo no loop
    // abaixo, já que o schema atual vincula no máximo um documento_id por
    // mensagem — não dá pra mandar N arquivos numa mensagem só.
    async function inserirMensagem(mensagemTexto: string, documentoId: string | null) {
      const { data: msg, error: erroInsert } = await supabase
        .from('mensagens_comunicado')
        .insert({
          comunicado_id: comunicadoId,
          autor_tipo: autorTipo,
          autor_id: userId,
          autor_nome: autorNome,
          mensagem: mensagemTexto,
          documento_id: documentoId,
        })
        .select('id')
        .single()

      if (erroInsert || !msg) {
        console.error('[ThreadComunicado] Erro ao inserir mensagem:', erroInsert)
        return null
      }

      try {
        const resposta = await fetch('/api/comunicados/notificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensagemId: msg.id }),
        })

        if (!resposta.ok) {
          const dados = await resposta.json().catch(() => null)
          console.error('[ThreadComunicado] /api/comunicados/notificar respondeu com erro:', resposta.status, dados)
        }
      } catch (erroNotificacao) {
        console.error('[ThreadComunicado] Falha de rede ao chamar /api/comunicados/notificar:', erroNotificacao)
      }

      return msg.id
    }

    const falhas: { nome: string; motivo: string }[] = []
    const arquivosComFalha: File[] = []
    let algumaMensagemCriada = false
    let textoConsumido = false

    if (arquivos.length === 0) {
      // Sem anexo: comportamento simples de sempre, uma mensagem só de texto.
      const id = await inserirMensagem(texteLimpo, null)
      if (!id) {
        setError('Não foi possível enviar a mensagem. Tente novamente.')
        setEnviando(false)
        return
      }
      algumaMensagemCriada = true
      textoConsumido = true
    } else {
      // Um arquivo por mensagem (limitação do schema: documento_id é 1:1 com
      // mensagem) — o texto digitado vai só na mensagem do primeiro arquivo.
      // Cada arquivo é tratado de forma independente: se um falhar (upload,
      // vínculo ou gravação da mensagem), os demais continuam normalmente.
      for (let i = 0; i < arquivos.length; i++) {
        const arquivoAtual = arquivos[i]
        const textoDesteArquivo = i === 0 ? texteLimpo : ''
        // Prefixo com timestamp evita colisão de nome no Storage — antes,
        // dois arquivos com o mesmo nome (inclusive em mensagens diferentes)
        // podiam se sobrescrever ou dar erro de "recurso já existe".
        const caminhoArquivo = `${clienteId}/${Date.now()}-${i}-${sanitizarNomeArquivo(arquivoAtual.name)}`

        const { error: uploadError } = await supabase.storage
          .from('documentos-clientes')
          .upload(caminhoArquivo, arquivoAtual)

        if (uploadError) {
          console.error(`[ThreadComunicado] Erro ao enviar "${arquivoAtual.name}" pro Storage:`, uploadError)
          falhas.push({ nome: arquivoAtual.name, motivo: uploadError.message })
          arquivosComFalha.push(arquivoAtual)
          continue
        }

        const extensao = arquivoAtual.name.split('.').pop() ?? ''

        const { data: documento, error: documentoError } = await supabase
          .from('documentos_clientes')
          .insert({
            cliente_id: clienteId,
            comunicado_id: comunicadoId,
            nome_arquivo: arquivoAtual.name,
            tipo: extensao,
            caminho_arquivo: caminhoArquivo,
          })
          .select('id')
          .single()

        if (documentoError || !documento) {
          console.error(`[ThreadComunicado] Erro ao vincular "${arquivoAtual.name}" à conversa:`, documentoError)
          falhas.push({ nome: arquivoAtual.name, motivo: 'falha ao vincular à conversa' })
          arquivosComFalha.push(arquivoAtual)
          continue
        }

        const id = await inserirMensagem(textoDesteArquivo, documento.id)
        if (!id) {
          falhas.push({ nome: arquivoAtual.name, motivo: 'falha ao salvar a mensagem' })
          arquivosComFalha.push(arquivoAtual)
          continue
        }

        algumaMensagemCriada = true
        if (i === 0) textoConsumido = true
      }

      // O texto digitado ficou "preso" ao primeiro arquivo — se ele falhou,
      // não descarta o que a pessoa escreveu: manda como mensagem separada.
      if (texteLimpo && !textoConsumido) {
        const id = await inserirMensagem(texteLimpo, null)
        if (id) {
          algumaMensagemCriada = true
          textoConsumido = true
        }
      }
    }

    // Só o cliente respondendo tira o comunicado de "pendente" — o admin
    // pode continuar a conversa livremente sem mexer no status (só ele
    // decide marcar como "concluído", usando o controle que já existe). Roda
    // uma vez só no final, não por arquivo, senão o histórico ficaria
    // poluído com uma entrada por anexo de um mesmo envio.
    if (algumaMensagemCriada) {
      if (autorTipo === 'cliente') {
        // Antes esses dois updates não checavam erro nenhum — se a RLS (ou
        // qualquer outra coisa) barrasse silenciosamente, a mensagem parecia
        // ter sido enviada com sucesso, mas o comunicado ficava preso em
        // "pendente" pra sempre, sem nenhum aviso no console. Agora qualquer
        // falha aqui fica registrada, mesmo não bloqueando o resto do fluxo
        // (a mensagem em si já foi salva).
        const { error: statusRespondidoError, data: statusRespondidoData } = await supabase
          .from('comunicados')
          .update({ status: 'respondido' })
          .eq('id', comunicadoId)
          .eq('status', 'pendente')
          .select('id')

        if (statusRespondidoError) {
          console.error(
            '[ThreadComunicado] Erro ao atualizar status para "respondido":',
            statusRespondidoError
          )
        } else if (statusRespondidoData && statusRespondidoData.length > 0) {
          // Só troca o estado local se o update realmente pegou uma linha
          // (ou seja, o comunicado estava mesmo "pendente") — evita mostrar
          // "respondido" na hora se, por algum motivo, o comunicado já
          // tivesse outro status.
          setStatus('respondido')
        }

        // visto_em sempre volta a zerar quando o cliente manda mensagem —
        // inclusive numa 2ª resposta antes do admin ter respondido de volta
        // (por isso é um update separado do de cima, sem o .eq('status',
        // 'pendente'): aquele só dispara na 1ª resposta, mas o cliente pode
        // mandar várias seguidas e cada uma deve "não visto" de novo).
        const { error: vistoEmError } = await supabase
          .from('comunicados')
          .update({ visto_em: null })
          .eq('id', comunicadoId)

        if (vistoEmError) {
          console.error('[ThreadComunicado] Erro ao zerar visto_em:', vistoEmError)
        }
      } else {
        registrarHistoricoAtividade({
          acao: 'enviou_comunicado',
          entidade: 'comunicado',
          entidadeId: comunicadoId,
          entidadeNome: `${tituloComunicado} — ${nomeCliente}`,
          detalhes: 'Resposta na conversa.',
        })

        // Mesma ideia de visto_em (acima): quando o ADMIN manda mensagem
        // nova, o cliente ainda não viu esse conteúdo, então
        // visualizado_pelo_cliente_em volta a zerar — senão o banner/página
        // de controle continuariam mostrando esse comunicado como "visto"
        // mesmo depois de uma resposta nova que o cliente nunca abriu.
        const { error: visualizadoZeradoError } = await supabase
          .from('comunicados')
          .update({ visualizado_pelo_cliente_em: null })
          .eq('id', comunicadoId)

        if (visualizadoZeradoError) {
          console.error('[ThreadComunicado] Erro ao zerar visualizado_pelo_cliente_em:', visualizadoZeradoError)
        }
      }
    }

    if (falhas.length > 0) {
      setError(
        `${falhas.length} de ${arquivos.length} arquivo(s) não foram enviados: ${falhas
          .map((falha) => `${falha.nome} (${falha.motivo})`)
          .join('; ')}`
      )
    }

    // Só limpa o que realmente foi enviado — arquivos com falha continuam
    // selecionados pra pessoa poder tentar de novo sem escolher tudo outra
    // vez, e o texto só some da caixa se tiver sido efetivamente salvo.
    if (textoConsumido) setTexto('')
    setArquivos(arquivosComFalha)
    setEnviando(false)

    if (algumaMensagemCriada) {
      const dados = await buscarMensagens(supabase, comunicadoId)
      setMensagens(dados)
      router.refresh()
    }
  }

  function removerArquivo(index: number) {
    setArquivos((atual) => atual.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Só o admin (Hederson) vê essa opção — o cliente nunca marca a
          própria conversa como concluída. */}
      {autorTipo === 'admin' && (
        <div className="flex items-center justify-end">
          {status === 'concluido' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c8e2a1] bg-[#eef7e0] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[#4f8f2a]">
              Conversa concluída
            </span>
          ) : (
            <button
              type="button"
              onClick={handleConcluir}
              disabled={concluindo}
              className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy disabled:cursor-not-allowed disabled:opacity-50"
            >
              {concluindo ? 'Marcando...' : 'Marcar conversa como concluída'}
            </button>
          )}
        </div>
      )}

      {/* Só aparece pro cliente num aviso que não exige resposta escrita
          (checkbox "Apenas aviso" marcado na criação) — ele ainda precisa
          dar ciência pra conversa fechar sozinha. Mesmo padrão visual do
          bloco do admin acima: botão enquanto pendente, badge depois de
          confirmado — sem o badge, o clique parecia "não fazer nada" (o
          botão só sumia, sem nenhuma confirmação visual no lugar). */}
      {autorTipo === 'cliente' && avisoInformativo && (
        <div className="flex items-center justify-end">
          {status === 'concluido' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c8e2a1] bg-[#eef7e0] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[#4f8f2a]">
              Conversa concluída
            </span>
          ) : (
            <button
              type="button"
              onClick={handleConcluir}
              disabled={concluindo}
              className="rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright disabled:cursor-not-allowed disabled:opacity-60"
            >
              {concluindo ? 'Confirmando...' : 'Estou ciente deste aviso'}
            </button>
          )}
        </div>
      )}

      {/* Fora do <form> de propósito: assim continua visível mesmo quando o
          formulário de resposta está escondido (aviso informativo), que é
          justamente quando um erro do handleConcluir mais precisa aparecer. */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {carregando ? (
        <p className="text-sm text-navy-soft">Carregando conversa...</p>
      ) : mensagens.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhuma mensagem ainda.</p>
      ) : (
        <>
          {/* Só aparece com uma thread já longa — poucas mensagens não
              precisam de busca, só atrapalhariam a tela. */}
          {mensagens.length > 8 && (
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nesta conversa..."
              className={inputClasses}
            />
          )}

          <div
            ref={listaRef}
            className="flex max-h-96 flex-col gap-3 overflow-y-auto rounded-lg border border-rule bg-paper-dim p-4"
          >
            {mensagensFiltradas.length === 0 ? (
              <p className="text-sm text-navy-soft">{`Nenhuma mensagem encontrada para "${busca}".`}</p>
            ) : (
              mensagensFiltradas.map((msg) => {
                const doCliente = msg.autor_tipo === 'cliente'
                return (
                  <div key={msg.id} className={`flex ${doCliente ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm shadow-sm ${
                        doCliente ? 'bg-lime/15 text-navy' : 'border border-rule bg-white text-charcoal'
                      }`}
                    >
                      <p className="mb-1 flex flex-wrap items-baseline gap-x-2 font-mono text-[10px] uppercase tracking-[0.04em] text-navy-soft">
                        <span className="font-semibold">{msg.autor_nome}</span>
                        <span>{formatarDataHora(msg.created_at)}</span>
                      </p>

                      {msg.mensagem && <p className="whitespace-pre-wrap">{msg.mensagem}</p>}

                      {msg.documento_id && msg.documentos_clientes && (
                        <button
                          type="button"
                          onClick={() => baixarAnexo(msg.documentos_clientes!.caminho_arquivo)}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
                        >
                          📎 {msg.documentos_clientes.nome_arquivo}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Aviso informativo (cliente): esconde a caixa de resposta inteira —
          texto, anexo e botão "Enviar". A única ação disponível é o botão
          "Estou ciente" acima; não faz sentido oferecer uma forma de
          escrever/anexar algo num aviso que não pede resposta nenhuma. */}
      {!(autorTipo === 'cliente' && avisoInformativo) && (
      <form onSubmit={handleEnviar} className="flex flex-col gap-2.5 rounded-lg border border-rule bg-white p-4">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder="Escreva uma mensagem..."
          className={`${inputClasses} resize-y`}
        />

        {tipoComunicado === 'solicitacao_documento' && (
          <>
            <input
              type="file"
              multiple
              onChange={(e) => {
                const novos = Array.from(e.target.files ?? [])
                if (novos.length === 0) return
                // Acrescenta em vez de substituir — abrir o seletor de novo
                // (ex: pra pegar mais um arquivo depois) não apaga o que já
                // tinha sido escolhido antes.
                setArquivos((atual) => [...atual, ...novos])
                e.target.value = ''
              }}
              className="block text-sm text-charcoal file:mr-3 file:rounded-[3px] file:border-[1.3px] file:border-navy file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy file:transition-colors file:duration-200 hover:file:bg-navy hover:file:text-paper"
            />

            {arquivos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {arquivos.map((arquivoSelecionado, index) => (
                  <span
                    key={`${arquivoSelecionado.name}-${arquivoSelecionado.lastModified}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper-dim px-2.5 py-1 text-xs text-charcoal"
                  >
                    📎 {arquivoSelecionado.name}
                    <button
                      type="button"
                      onClick={() => removerArquivo(index)}
                      aria-label={`Remover ${arquivoSelecionado.name}`}
                      className="ml-0.5 leading-none text-navy-soft transition-colors duration-200 hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="self-start rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright disabled:opacity-60"
        >
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
      )}
    </div>
  )
}

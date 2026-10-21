'use client'

import { useState } from 'react'
import { TIPOS_SEM_VENCIMENTO, type ArquivoRevisado, type ClienteOption } from '@/lib/envioMensal'
import { mensagemInformativa } from '@/lib/email/templates'

const TAMANHO_LOTE = 5

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarCompetencia(competencia: string) {
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano}`
}

type Falha = { clienteId: string; nomeCliente: string; motivo: string }

type ResultadoEnvio = {
  emailsEnviados: number
  totalClientes: number
  falhas: Falha[]
}

type Progresso = {
  loteAtual: number
  totalLotes: number
  clientesProcessados: number
}

export default function EnvioMensalConfirmacao({
  competencia,
  clientes,
  arquivosRevisados,
  onVoltar,
}: {
  competencia: string
  clientes: ClienteOption[]
  arquivosRevisados: ArquivoRevisado[]
  onVoltar: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<ResultadoEnvio | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)

  const gruposPorCliente = new Map<string, ArquivoRevisado[]>()
  for (const arquivo of arquivosRevisados) {
    const lista = gruposPorCliente.get(arquivo.clienteId) ?? []
    lista.push(arquivo)
    gruposPorCliente.set(arquivo.clienteId, lista)
  }

  function nomeCliente(clienteId: string) {
    return clientes.find((cliente) => cliente.id === clienteId)?.nome_empresa ?? 'Cliente'
  }

  const totalClientes = gruposPorCliente.size
  const totalArquivos = arquivosRevisados.length

  // Monta um JSON pequeno (caminhos do Storage + metadados) em vez de
  // mandar os arquivos binários — é essa troca que resolve o bug "Falha de
  // rede ou tempo esgotado": o payload agora nunca chega perto do limite
  // de 4,5 MB da Vercel, porque os bytes de verdade já estão no Storage
  // desde a Etapa 2 (ver uploadParaStorageTemp em EnvioMensalArquivos.tsx).
  // api/envio-mensal/route.ts busca cada arquivo pelo caminho recebido.
  function montarGruposLote(entradasLote: [string, ArquivoRevisado[]][]) {
    return entradasLote.map(([clienteId, arquivos]) => ({
      clienteId,
      arquivos: arquivos.map((arquivo) => ({
        chave: arquivo.id,
        nomeArquivo: arquivo.nomeArquivo,
        tipo: arquivo.tipo,
        dataVencimento: arquivo.dataVencimento,
        caminhoStorageTemp: arquivo.caminhoStorageTemp,
      })),
    }))
  }

  function falhaParaTodos(entradasLote: [string, ArquivoRevisado[]][], motivo: string): Falha[] {
    return entradasLote.map(([clienteId]) => ({ clienteId, nomeCliente: nomeCliente(clienteId), motivo }))
  }

  // Cada etapa (chamar o servidor, ler a resposta, checar o status) tem seu
  // próprio tratamento de erro específico — antes, qualquer uma das três
  // falhando caía no mesmo catch genérico lá em handleEnviar, e todo mundo
  // via "Falha de rede ou tempo esgotado" mesmo quando a causa real era
  // outra (ex: resposta que não era JSON válido). Essa distinção ajuda a
  // diagnosticar um problema NOVO mais rápido, sem precisar investigar o
  // código de novo pra descobrir que, na real, não foi rede nem tempo.
  async function enviarLote(entradasLote: [string, ArquivoRevisado[]][]) {
    const gruposLote = montarGruposLote(entradasLote)

    let resposta: Response
    try {
      resposta = await fetch('/api/envio-mensal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competencia, grupos: gruposLote }),
      })
    } catch {
      return {
        emailsEnviados: 0,
        falhas: falhaParaTodos(
          entradasLote,
          'Falha de rede ao chamar o servidor. Verifique sua conexão e tente reenviar este(s) cliente(s).'
        ),
      }
    }

    let dados: { emailsEnviados?: number; falhas?: Falha[]; error?: string } | null = null
    try {
      dados = await resposta.json()
    } catch {
      return {
        emailsEnviados: 0,
        falhas: falhaParaTodos(
          entradasLote,
          `O servidor respondeu de um jeito inesperado (status ${resposta.status}). Tente reenviar este(s) cliente(s).`
        ),
      }
    }

    if (!resposta.ok) {
      const motivo = typeof dados?.error === 'string' ? dados.error : `Falha ao processar este lote (status ${resposta.status}).`
      return { emailsEnviados: 0, falhas: falhaParaTodos(entradasLote, motivo) }
    }

    return { emailsEnviados: dados?.emailsEnviados ?? 0, falhas: dados?.falhas ?? [] }
  }

  async function handleEnviar() {
    const confirmado = window.confirm(
      `Enviar ${totalClientes} e-mail(s) agora, com ${totalArquivos} anexo(s) no total? Essa ação não pode ser desfeita.`
    )
    if (!confirmado) return

    setErro('')
    setEnviando(true)

    const entradas = Array.from(gruposPorCliente.entries())
    const lotes: [string, ArquivoRevisado[]][][] = []
    for (let i = 0; i < entradas.length; i += TAMANHO_LOTE) {
      lotes.push(entradas.slice(i, i + TAMANHO_LOTE))
    }

    let emailsEnviados = 0
    let clientesProcessados = 0
    const falhas: Falha[] = []

    for (let i = 0; i < lotes.length; i++) {
      setProgresso({ loteAtual: i + 1, totalLotes: lotes.length, clientesProcessados })

      try {
        const resultadoLote = await enviarLote(lotes[i])
        emailsEnviados += resultadoLote.emailsEnviados
        falhas.push(...resultadoLote.falhas)
      } catch (erroInesperado) {
        // Última linha de defesa — enviarLote já trata rede, resposta
        // inválida e status de erro com mensagem específica cada um; só
        // chega aqui algo realmente imprevisto (ex: bug no código acima).
        console.error('[EnvioMensalConfirmacao] Erro inesperado ao processar lote:', erroInesperado)
        falhas.push(
          ...lotes[i].map(([clienteId]) => ({
            clienteId,
            nomeCliente: nomeCliente(clienteId),
            motivo: 'Erro inesperado ao processar este lote. Reenvie este(s) cliente(s).',
          }))
        )
      }

      clientesProcessados += lotes[i].length
      setProgresso({ loteAtual: i + 1, totalLotes: lotes.length, clientesProcessados })
    }

    setResultado({ emailsEnviados, totalClientes, falhas })
    setProgresso(null)
    setEnviando(false)
  }

  if (resultado) {
    return (
      <div className="max-w-2xl">
        <h2 className="mb-2 font-display text-lg font-semibold text-navy">Envio concluído</h2>
        <p className="mb-4 text-sm text-navy-soft">
          {resultado.emailsEnviados} de {resultado.totalClientes} e-mail(s) enviados com sucesso.
        </p>

        {resultado.falhas.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
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
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-rule bg-white p-4">
        <p className="text-sm text-navy-soft">
          <strong className="text-navy">{totalClientes}</strong> cliente(s) serão notificados, num total de{' '}
          <strong className="text-navy">{totalArquivos}</strong> anexo(s) — competência{' '}
          <strong className="text-navy">{formatarCompetencia(competencia)}</strong>. O envio será feito em lotes
          de até {TAMANHO_LOTE} cliente(s) por vez.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {Array.from(gruposPorCliente.entries()).map(([clienteId, arquivos]) => {
          const comVencimento = arquivos.filter((arquivo) => !TIPOS_SEM_VENCIMENTO.includes(arquivo.tipo))
          const informativos = arquivos.filter((arquivo) => TIPOS_SEM_VENCIMENTO.includes(arquivo.tipo))
          const tiposInformativos = [...new Set(informativos.map((arquivo) => arquivo.tipo))]

          return (
            <div key={clienteId} className="rounded-lg border border-rule bg-white p-4">
              <h3 className="mb-2 font-display text-base font-semibold text-navy">{nomeCliente(clienteId)}</h3>
              <div className="rounded-md bg-paper-dim p-3 font-mono text-[12.5px] text-charcoal">
                {comVencimento.length > 0 && (
                  <>
                    {comVencimento.map((arquivo) => (
                      <p key={arquivo.id}>
                        {arquivo.tipo} - VENCIMENTO{' '}
                        {arquivo.dataVencimento ? formatarData(arquivo.dataVencimento) : '—'}
                      </p>
                    ))}
                    <p className="mt-2 text-navy-soft">
                      Segue os impostos referente ao mês {formatarCompetencia(competencia)}.
                    </p>
                  </>
                )}
                {tiposInformativos.map((tipo) => (
                  <p key={tipo} className="mt-2 text-navy-soft">
                    {mensagemInformativa(tipo)}
                  </p>
                ))}
              </div>
              <p className="mt-2 text-xs text-navy-soft">
                {arquivos.length} anexo(s): {arquivos.map((arquivo) => arquivo.nomeArquivo).join(', ')}
              </p>
            </div>
          )
        })}
      </div>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      {progresso && (
        <div className="mt-6 max-w-md">
          <p className="mb-2 text-sm text-navy-soft">
            Enviando lote {progresso.loteAtual} de {progresso.totalLotes} — {progresso.clientesProcessados} de{' '}
            {totalClientes} cliente(s) processados
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-paper-dim">
            <div
              className="h-2 rounded-full bg-lime transition-[width] duration-300 ease-out"
              style={{ width: `${Math.round((progresso.clientesProcessados / totalClientes) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={onVoltar}
          disabled={enviando}
          className="rounded-[3px] border-[1.3px] border-navy px-5 py-2.5 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper disabled:opacity-50"
        >
          ← Voltar
        </button>
        <button
          type="button"
          onClick={handleEnviar}
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:opacity-60"
        >
          {enviando
            ? progresso
              ? `Enviando lote ${progresso.loteAtual} de ${progresso.totalLotes}...`
              : 'Enviando...'
            : 'Enviar e-mails'}
        </button>
      </div>
    </div>
  )
}

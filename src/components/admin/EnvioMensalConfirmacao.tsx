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

  async function enviarLote(entradasLote: [string, ArquivoRevisado[]][]) {
    const formData = new FormData()
    formData.append('competencia', competencia)

    const gruposLote = entradasLote.map(([clienteId, arquivos]) => ({
      clienteId,
      arquivos: arquivos.map((arquivo) => ({
        chave: arquivo.id,
        nomeArquivo: arquivo.file.name,
        tipo: arquivo.tipo,
        dataVencimento: arquivo.dataVencimento,
      })),
    }))

    formData.append('grupos', JSON.stringify(gruposLote))

    for (const [, arquivos] of entradasLote) {
      for (const arquivo of arquivos) {
        formData.append(arquivo.id, arquivo.file)
      }
    }

    const resposta = await fetch('/api/envio-mensal', { method: 'POST', body: formData })
    const dados = await resposta.json()

    if (!resposta.ok) {
      const motivo = typeof dados?.error === 'string' ? dados.error : 'Falha ao processar este lote.'
      return {
        emailsEnviados: 0,
        falhas: entradasLote.map(([clienteId]) => ({ clienteId, nomeCliente: nomeCliente(clienteId), motivo })),
      }
    }

    return { emailsEnviados: dados.emailsEnviados as number, falhas: dados.falhas as Falha[] }
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
      } catch {
        falhas.push(
          ...lotes[i].map(([clienteId]) => ({
            clienteId,
            nomeCliente: nomeCliente(clienteId),
            motivo: 'Falha de rede ou tempo esgotado ao enviar este lote. Reenvie apenas este(s) cliente(s).',
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
                {arquivos.length} anexo(s): {arquivos.map((arquivo) => arquivo.file.name).join(', ')}
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

'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type Resumo = {
  totalGerados: number
  totalPulados: number
  porCliente: { clienteId: string; nomeCliente: string; gerados: number }[]
}

// Chama /api/admin/gerar-prazos — com competencia, gera retroativamente pra
// aquele mês; sem, gera a competência normal (mês seguinte ao atual).
async function chamarGeracao(competencia?: string): Promise<Resumo> {
  const resposta = await fetch('/api/admin/gerar-prazos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(competencia ? { competencia } : {}),
  })

  const dados = await resposta.json().catch(() => null)

  if (!resposta.ok || !dados) {
    throw new Error(dados?.error ?? `Erro HTTP ${resposta.status} ao gerar prazos.`)
  }

  return dados as Resumo
}

// Dispara a MESMA lógica do cron semanal (gerarPrazosAutomaticos), só que
// via /api/admin/gerar-prazos (guard de sessão+role) em vez de
// /api/cron/gerar-prazos (guard de CRON_SECRET) — o segredo do cron nunca
// pode ficar acessível no navegador. Seguro de clicar mais de uma vez: é
// idempotente, não duplica prazo já gerado.
export default function GerarPrazosButton() {
  const router = useRouter()

  const [processando, setProcessando] = useState(false)
  const [resultado, setResultado] = useState<Resumo | null>(null)
  const [erro, setErro] = useState('')

  const [competenciaAlvo, setCompetenciaAlvo] = useState('')
  const [processandoRetroativo, setProcessandoRetroativo] = useState(false)
  const [resultadoRetroativo, setResultadoRetroativo] = useState<Resumo | null>(null)
  const [erroRetroativo, setErroRetroativo] = useState('')

  async function handleClick() {
    setProcessando(true)
    setErro('')
    setResultado(null)

    try {
      const dados = await chamarGeracao()
      setResultado(dados)
      router.refresh()
    } catch (excecao) {
      console.error('Erro ao gerar prazos:', excecao)
      setErro(excecao instanceof Error ? excecao.message : 'Falha de rede ao gerar prazos.')
    } finally {
      setProcessando(false)
    }
  }

  async function handleSubmitRetroativo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!competenciaAlvo) return

    setProcessandoRetroativo(true)
    setErroRetroativo('')
    setResultadoRetroativo(null)

    try {
      const dados = await chamarGeracao(competenciaAlvo)
      setResultadoRetroativo(dados)
      router.refresh()
    } catch (excecao) {
      console.error('Erro ao gerar prazos retroativos:', excecao)
      setErroRetroativo(excecao instanceof Error ? excecao.message : 'Falha de rede ao gerar prazos.')
    } finally {
      setProcessandoRetroativo(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={handleClick}
          disabled={processando}
          className="text-xs font-semibold text-navy-soft underline decoration-rule underline-offset-2 transition-colors duration-200 hover:text-navy hover:decoration-navy disabled:cursor-not-allowed disabled:opacity-50"
        >
          {processando ? 'Gerando prazos...' : 'Gerar prazos agora'}
        </button>

        {resultado && (
          <p className="max-w-[260px] text-right text-xs text-navy-soft">
            {resultado.totalGerados} gerado(s) · {resultado.totalPulados} já existiam
          </p>
        )}

        {erro && <p className="max-w-[260px] text-right text-xs text-red-600">{erro}</p>}
      </div>

      {/* Ferramenta de ajuste pontual (preencher uma competência específica
          que ficou sem geração) — separada visualmente do botão principal,
          que é o uso normal do dia a dia. */}
      <form
        onSubmit={handleSubmitRetroativo}
        className="flex flex-col items-end gap-1.5 rounded-md border border-dashed border-rule bg-paper-dim px-3 py-2.5"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-navy-soft">
          Gerar retroativo para um mês específico
        </p>
        <div className="flex items-center gap-2">
          <input
            type="month"
            required
            value={competenciaAlvo}
            onChange={(e) => setCompetenciaAlvo(e.target.value)}
            className="rounded-[3px] border border-rule bg-white px-2.5 py-1 text-xs text-charcoal outline-none focus:border-lime"
          />
          <button
            type="submit"
            disabled={processandoRetroativo || !competenciaAlvo}
            className="rounded-[3px] border-[1.3px] border-navy px-3 py-1 text-xs font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processandoRetroativo ? 'Gerando...' : 'Gerar'}
          </button>
        </div>

        {resultadoRetroativo && (
          <p className="max-w-[260px] text-right text-xs text-navy-soft">
            {resultadoRetroativo.totalGerados} gerado(s) · {resultadoRetroativo.totalPulados} já existiam
          </p>
        )}

        {erroRetroativo && <p className="max-w-[260px] text-right text-xs text-red-600">{erroRetroativo}</p>}
      </form>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Lotes pequenos pro front não disparar uma chamada só com centenas de ids
// de uma vez — cada lote vira uma requisição POST pra
// /api/clientes/verificar-regime, que já espaça as chamadas à BrasilAPI
// internamente (300ms entre cada CNPJ).
const TAMANHO_LOTE = 5

type Resumo = {
  mei: number
  simples_nacional: number
  manual: number
  falhas: number
  segmentos_atualizados: number
}

function dividirEmLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho))
  }
  return lotes
}

export default function VerificarRegimeButton({ clienteIds }: { clienteIds: string[] }) {
  const router = useRouter()

  const [processando, setProcessando] = useState(false)
  const [progresso, setProgresso] = useState({ feito: 0, total: 0 })
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [erro, setErro] = useState('')

  async function handleClick() {
    if (clienteIds.length === 0 || processando) return

    setProcessando(true)
    setResumo(null)
    setErro('')
    setProgresso({ feito: 0, total: clienteIds.length })

    const lotes = dividirEmLotes(clienteIds, TAMANHO_LOTE)
    const resumoAcumulado: Resumo = { mei: 0, simples_nacional: 0, manual: 0, falhas: 0, segmentos_atualizados: 0 }
    const mensagensErro: string[] = []

    for (const lote of lotes) {
      try {
        const resposta = await fetch('/api/clientes/verificar-regime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cliente_ids: lote }),
        })

        const dados = await resposta.json().catch(() => null)

        if (resposta.ok && dados?.resumo) {
          resumoAcumulado.mei += dados.resumo.mei
          resumoAcumulado.simples_nacional += dados.resumo.simples_nacional
          resumoAcumulado.manual += dados.resumo.manual
          resumoAcumulado.falhas += dados.resumo.falhas
          resumoAcumulado.segmentos_atualizados += dados.resumo.segmentos_atualizados ?? 0
        } else {
          resumoAcumulado.falhas += lote.length
          const mensagem = dados?.error ?? `Erro HTTP ${resposta.status} ao verificar este lote.`
          console.error('Erro ao verificar regime (lote):', { status: resposta.status, dados })
          if (!mensagensErro.includes(mensagem)) mensagensErro.push(mensagem)
        }
      } catch (excecao) {
        resumoAcumulado.falhas += lote.length
        const mensagem = excecao instanceof Error ? excecao.message : 'Falha de rede ao chamar a verificação.'
        console.error('Erro ao verificar regime (exceção):', excecao)
        if (!mensagensErro.includes(mensagem)) mensagensErro.push(mensagem)
      }

      setProgresso((atual) => ({ ...atual, feito: atual.feito + lote.length }))
    }

    setResumo(resumoAcumulado)
    setErro(mensagensErro.join(' | '))
    setProcessando(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={processando || clienteIds.length === 0}
        className="inline-flex items-center gap-2 rounded-[3px] border-[1.3px] border-navy px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
      >
        {processando ? `Verificando ${progresso.feito}/${progresso.total}...` : 'Verificar regime automaticamente'}
      </button>

      {resumo && (
        <p className="max-w-[260px] text-right text-xs text-navy-soft">
          MEI: {resumo.mei} · Simples: {resumo.simples_nacional} · Confirmar manualmente: {resumo.manual} · Falhas:{' '}
          {resumo.falhas} · Segmentos preenchidos: {resumo.segmentos_atualizados}
        </p>
      )}

      {erro && <p className="max-w-[260px] text-right text-xs text-red-600">{erro}</p>}
    </div>
  )
}

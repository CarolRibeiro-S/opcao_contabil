'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Lotes pequenos pro front não disparar uma chamada só com centenas de ids
// de uma vez — cada lote vira uma requisição POST pra
// /api/clientes/verificar-regime, que já espaça as chamadas à BrasilAPI
// internamente (300ms entre cada CNPJ).
const TAMANHO_LOTE = 5

type Resumo = { mei: number; simples_nacional: number; manual: number; falhas: number }

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

  async function handleClick() {
    if (clienteIds.length === 0 || processando) return

    setProcessando(true)
    setResumo(null)
    setProgresso({ feito: 0, total: clienteIds.length })

    const lotes = dividirEmLotes(clienteIds, TAMANHO_LOTE)
    const resumoAcumulado: Resumo = { mei: 0, simples_nacional: 0, manual: 0, falhas: 0 }

    for (const lote of lotes) {
      try {
        const resposta = await fetch('/api/clientes/verificar-regime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cliente_ids: lote }),
        })

        const dados = await resposta.json()

        if (resposta.ok) {
          resumoAcumulado.mei += dados.resumo.mei
          resumoAcumulado.simples_nacional += dados.resumo.simples_nacional
          resumoAcumulado.manual += dados.resumo.manual
          resumoAcumulado.falhas += dados.resumo.falhas
        } else {
          resumoAcumulado.falhas += lote.length
        }
      } catch {
        resumoAcumulado.falhas += lote.length
      }

      setProgresso((atual) => ({ ...atual, feito: atual.feito + lote.length }))
    }

    setResumo(resumoAcumulado)
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
          {resumo.falhas}
        </p>
      )}
    </div>
  )
}

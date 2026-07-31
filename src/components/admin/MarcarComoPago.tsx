'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { reverterReceitaDoHonorario, sincronizarReceitaDoHonorario } from '@/lib/receitaHonorario'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'

export default function MarcarComoPago({
  id,
  status,
  entidadeNome,
}: {
  id: string
  status: string
  entidadeNome: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleMarcarComoPago() {
    setLoading(true)
    const hoje = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('cobrancas')
      .update({ status: 'pago', data_pagamento: hoje })
      .eq('id', id)

    if (!error) {
      await sincronizarReceitaDoHonorario(supabase, id)
      registrarHistoricoAtividade({
        acao: 'marcou_pago',
        entidade: 'honorario',
        entidadeId: id,
        entidadeNome,
      })
    }

    setLoading(false)
    router.refresh()
  }

  async function handleReverterPagamento() {
    if (!window.confirm('Reverter esse pagamento para em aberto?')) return

    setLoading(true)
    const { error } = await supabase
      .from('cobrancas')
      .update({ status: 'em_aberto', data_pagamento: null })
      .eq('id', id)

    if (!error) {
      await reverterReceitaDoHonorario(supabase, id)
      registrarHistoricoAtividade({
        acao: 'reverteu_pagamento',
        entidade: 'honorario',
        entidadeId: id,
        entidadeNome,
      })
    }

    setLoading(false)
    router.refresh()
  }

  if (status === 'pago') {
    return (
      <button
        type="button"
        onClick={handleReverterPagamento}
        disabled={loading}
        className="text-xs font-medium text-navy-soft/70 underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy-soft disabled:opacity-50"
      >
        {loading ? '...' : 'Reverter pagamento'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleMarcarComoPago}
      disabled={loading}
      className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy disabled:opacity-50"
    >
      {loading ? '...' : 'Marcar como pago'}
    </button>
  )
}

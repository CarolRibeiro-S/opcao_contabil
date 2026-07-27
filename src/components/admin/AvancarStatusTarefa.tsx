'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PROXIMO_STATUS: Record<string, string> = {
  a_fazer: 'em_andamento',
  em_andamento: 'concluida',
  concluida: 'a_fazer',
}

const ROTULO_ACAO: Record<string, string> = {
  a_fazer: 'Iniciar',
  em_andamento: 'Concluir',
  concluida: 'Reabrir',
}

export default function AvancarStatusTarefa({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const proximoStatus = PROXIMO_STATUS[status] ?? 'a_fazer'

  async function handleClick() {
    setLoading(true)
    await supabase.from('tarefas').update({ status: proximoStatus }).eq('id', id)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy disabled:opacity-50"
    >
      {loading ? '...' : (ROTULO_ACAO[status] ?? 'Avançar')}
    </button>
  )
}

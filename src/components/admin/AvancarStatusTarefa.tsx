'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'

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

const ROTULO_STATUS: Record<string, string> = {
  a_fazer: 'A Fazer',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
}

export default function AvancarStatusTarefa({
  id,
  titulo,
  status,
}: {
  id: string
  titulo: string
  status: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const proximoStatus = PROXIMO_STATUS[status] ?? 'a_fazer'

  async function handleClick() {
    setLoading(true)
    const { error } = await supabase.from('tarefas').update({ status: proximoStatus }).eq('id', id)
    setLoading(false)

    if (!error) {
      registrarHistoricoAtividade({
        acao: 'editou',
        entidade: 'tarefa',
        entidadeId: id,
        entidadeNome: titulo,
        detalhes: `Status alterado de "${ROTULO_STATUS[status] ?? status}" para "${ROTULO_STATUS[proximoStatus] ?? proximoStatus}"`,
      })
    }

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

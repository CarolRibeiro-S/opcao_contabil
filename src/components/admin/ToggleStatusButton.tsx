'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ToggleStatusButton({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const proximoStatus = status === 'ativo' ? 'inativo' : 'ativo'

  async function handleToggle() {
    setLoading(true)
    await supabase.from('clientes').update({ status: proximoStatus }).eq('id', id)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy disabled:opacity-50"
    >
      {loading ? '...' : status === 'ativo' ? 'Inativar' : 'Ativar'}
    </button>
  )
}

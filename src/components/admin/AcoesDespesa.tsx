'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AcoesDespesa({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function fecharAoClicarFora(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAberto(false)
      }
    }

    document.addEventListener('mousedown', fecharAoClicarFora)
    return () => document.removeEventListener('mousedown', fecharAoClicarFora)
  }, [])

  async function alternarPagamento() {
    setCarregando(true)

    const atualizacao =
      status === 'pago'
        ? { status: 'em_aberto', data_pagamento: null }
        : { status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) }

    const { error } = await supabase.from('despesas').update(atualizacao).eq('id', id)

    setCarregando(false)
    setAberto(false)

    if (error) {
      window.alert('Não foi possível atualizar a despesa. Tente novamente.')
      return
    }

    router.refresh()
  }

  async function excluir() {
    const confirmado = window.confirm(
      'Tem certeza que deseja excluir esta despesa? Essa ação não pode ser desfeita.'
    )
    if (!confirmado) return

    setCarregando(true)

    const { error } = await supabase.from('despesas').delete().eq('id', id)

    setCarregando(false)
    setAberto(false)

    if (error) {
      window.alert('Não foi possível excluir a despesa. Tente novamente.')
      return
    }

    router.refresh()
  }

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-label="Abrir ações"
        aria-expanded={aberto}
        className="flex h-8 w-8 items-center justify-center rounded-md text-navy-soft transition-colors duration-200 hover:bg-paper-dim hover:text-navy"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <circle cx="4" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="16" cy="10" r="1.6" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-lg border border-rule bg-white py-1 shadow-lg">
          <Link
            href={`/admin/financeiro/despesas/${id}/editar`}
            className="block px-4 py-2 text-sm text-charcoal transition-colors duration-200 hover:bg-paper-dim"
          >
            Editar
          </Link>

          <button
            type="button"
            onClick={alternarPagamento}
            disabled={carregando}
            className="block w-full px-4 py-2 text-left text-sm text-charcoal transition-colors duration-200 hover:bg-paper-dim disabled:opacity-50"
          >
            {status === 'pago' ? 'Reverter pagamento' : 'Marcar como pago'}
          </button>

          <div className="my-1 border-t border-rule" />

          <button
            type="button"
            onClick={excluir}
            disabled={carregando}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 transition-colors duration-200 hover:bg-red-50 disabled:opacity-50"
          >
            Excluir
          </button>
        </div>
      )}
    </div>
  )
}

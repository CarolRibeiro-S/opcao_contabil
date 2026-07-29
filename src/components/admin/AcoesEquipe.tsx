'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AcoesEquipe({
  id,
  status,
  ehUsuarioLogado,
}: {
  id: string
  status: string
  ehUsuarioLogado: boolean
}) {
  const router = useRouter()
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

  async function alternarStatus() {
    setCarregando(true)

    const resposta = await fetch('/api/equipe/atualizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: status === 'ativo' ? 'inativo' : 'ativo' }),
    })

    setCarregando(false)
    setAberto(false)

    if (resposta.ok) {
      router.refresh()
    } else {
      const dados = await resposta.json().catch(() => null)
      window.alert(dados?.error ?? 'Não foi possível atualizar o status.')
    }
  }

  async function excluir() {
    const confirmado = window.confirm(
      'Tem certeza que deseja excluir este membro? Essa ação remove o acesso dele ao sistema e não pode ser desfeita.'
    )
    if (!confirmado) return

    setCarregando(true)

    const resposta = await fetch('/api/equipe/excluir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })

    setCarregando(false)
    setAberto(false)

    if (resposta.ok) {
      router.refresh()
    } else {
      const dados = await resposta.json().catch(() => null)
      window.alert(dados?.error ?? 'Não foi possível excluir o membro.')
    }
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
        <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-lg border border-rule bg-white py-1 shadow-lg">
          <Link
            href={`/admin/equipe/${id}/editar`}
            className="block px-4 py-2 text-sm text-charcoal transition-colors duration-200 hover:bg-paper-dim"
          >
            Editar
          </Link>

          {!ehUsuarioLogado && (
            <button
              type="button"
              onClick={alternarStatus}
              disabled={carregando}
              className="block w-full px-4 py-2 text-left text-sm text-charcoal transition-colors duration-200 hover:bg-paper-dim disabled:opacity-50"
            >
              {status === 'ativo' ? 'Inativar' : 'Ativar'}
            </button>
          )}

          {!ehUsuarioLogado && (
            <button
              type="button"
              onClick={excluir}
              disabled={carregando}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 transition-colors duration-200 hover:bg-red-50 disabled:opacity-50"
            >
              Excluir
            </button>
          )}
        </div>
      )}
    </div>
  )
}

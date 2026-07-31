'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useMenuAncorado } from '@/hooks/useMenuAncorado'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'

export default function AcoesReceita({
  id,
  status,
  origem,
  descricao,
}: {
  id: string
  status: string
  origem: string
  descricao: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const { aberto, setAberto, posicao, botaoRef, painelRef, alternar } = useMenuAncorado()
  const [carregando, setCarregando] = useState(false)

  async function alternarRecebimento() {
    setCarregando(true)

    const marcandoComoRecebido = status !== 'recebido'
    const atualizacao = marcandoComoRecebido
      ? { status: 'recebido', data_recebimento: new Date().toISOString().slice(0, 10) }
      : { status: 'a_receber', data_recebimento: null }

    const { error } = await supabase.from('receitas').update(atualizacao).eq('id', id)

    setCarregando(false)
    setAberto(false)

    if (error) {
      window.alert('Não foi possível atualizar a receita. Tente novamente.')
      return
    }

    registrarHistoricoAtividade({
      acao: marcandoComoRecebido ? 'marcou_pago' : 'reverteu_pagamento',
      entidade: 'receita',
      entidadeId: id,
      entidadeNome: descricao,
    })

    router.refresh()
  }

  async function excluir() {
    const confirmado = window.confirm(
      'Tem certeza que deseja excluir esta receita? Essa ação não pode ser desfeita.'
    )
    if (!confirmado) return

    setCarregando(true)

    const { error } = await supabase.from('receitas').delete().eq('id', id)

    setCarregando(false)
    setAberto(false)

    if (error) {
      window.alert('Não foi possível excluir a receita. Tente novamente.')
      return
    }

    registrarHistoricoAtividade({
      acao: 'excluiu',
      entidade: 'receita',
      entidadeId: id,
      entidadeNome: descricao,
    })

    router.refresh()
  }

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={alternar}
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

      {aberto &&
        createPortal(
          <div
            ref={painelRef}
            style={{ position: 'fixed', top: posicao.top, left: posicao.left, transform: 'translateX(-100%)' }}
            className="z-[100] w-56 overflow-hidden rounded-lg border border-rule bg-white py-1 shadow-lg"
          >
            <Link
              href={`/admin/financeiro/receitas/${id}/editar`}
              className="block px-4 py-2 text-sm text-charcoal transition-colors duration-200 hover:bg-paper-dim"
            >
              Editar
            </Link>

            <button
              type="button"
              onClick={alternarRecebimento}
              disabled={carregando}
              className="block w-full px-4 py-2 text-left text-sm text-charcoal transition-colors duration-200 hover:bg-paper-dim disabled:opacity-50"
            >
              {status === 'recebido' ? 'Reverter recebimento' : 'Marcar como recebido'}
            </button>

            <div className="my-1 border-t border-rule" />

            {origem === 'honorario' ? (
              <p
                className="px-4 py-2 text-xs leading-snug text-navy-soft/70"
                title="Reverta o pagamento do honorário original em Honorários Contábeis pra desfazer"
              >
                Excluir indisponível — gerado automaticamente por um honorário
              </p>
            ) : (
              <button
                type="button"
                onClick={excluir}
                disabled={carregando}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 transition-colors duration-200 hover:bg-red-50 disabled:opacity-50"
              >
                Excluir
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

const navLinks = [
  { href: '#servicos', label: 'Serviços' },
  { href: '#sobre', label: 'Sobre' },
  { href: '#diferencial', label: 'Diferencial' },
  { href: '#contato', label: 'Contato' },
]

export default function HeaderMobileMenu() {
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!aberto) return

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
    }
  }, [aberto])

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        className="flex h-11 w-11 items-center justify-center rounded-md text-navy transition-colors duration-200 hover:bg-navy/5"
      >
        <span className="text-2xl leading-none">☰</span>
      </button>

      {aberto &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-paper px-6 pb-6 pt-6">
            <div className="mb-8 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="flex h-11 w-11 items-center justify-center rounded-md text-navy transition-colors duration-200 hover:bg-navy/5"
              >
                <span className="text-2xl leading-none">✕</span>
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setAberto(false)}
                  className="rounded-md px-3 py-3 text-base font-medium text-navy-soft transition-colors duration-200 hover:bg-navy/5 hover:text-navy"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-3 border-t border-rule pt-6">
              <Link
                href="/login"
                onClick={() => setAberto(false)}
                className="inline-flex items-center justify-center gap-2 rounded-[3px] border-[1.3px] border-navy px-5 py-3 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper"
              >
                Portal do Cliente
              </Link>
              <Link
                href="/login"
                onClick={() => setAberto(false)}
                className="inline-flex items-center justify-center gap-2 rounded-[3px] bg-lime px-5 py-3 text-sm font-semibold text-navy transition duration-200 hover:bg-lime-bright"
              >
                Painel do Contador
              </Link>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

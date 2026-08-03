'use client'

import { useState } from 'react'
import Image, { type StaticImageData } from 'next/image'
import LogoutButton from '@/components/shared/LogoutButton'
import { SidebarNavItem, SidebarUsuario, type SidebarLink } from '@/components/shared/Sidebar'

export default function AdminMobileNav({
  logo,
  titulo,
  subtitulo,
  navLinks,
  usuarioNome,
  usuarioEmail,
}: {
  logo: StaticImageData
  titulo: string
  subtitulo?: string
  navLinks: SidebarLink[]
  usuarioNome: string
  usuarioEmail?: string | null
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <div className="md:hidden">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/15 bg-navy px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Image src={logo} alt="Opção Contábil" className="h-8 w-auto shrink-0" />
          <span
            title={titulo}
            className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-lime"
          >
            {titulo}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-paper transition-colors duration-200 hover:bg-white/10"
        >
          <span className="text-2xl leading-none">☰</span>
        </button>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setAberto(false)} />
          <div className="relative ml-auto flex h-full w-[82%] max-w-[300px] flex-col bg-navy p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <Image src={logo} alt="Opção Contábil" className="h-9 w-auto" />
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="flex h-11 w-11 items-center justify-center rounded-md text-paper transition-colors duration-200 hover:bg-white/10"
              >
                <span className="text-2xl leading-none">✕</span>
              </button>
            </div>

            <p
              title={titulo}
              className="line-clamp-2 min-w-0 overflow-hidden break-words font-mono text-[11px] uppercase tracking-[0.1em] text-lime"
            >
              {titulo}
            </p>
            {subtitulo && (
              <p title={subtitulo} className="mt-1 truncate text-sm font-medium text-white">
                {subtitulo}
              </p>
            )}

            <div className="mt-6 border-t border-white/10" />

            <nav className="sidebar-scroll mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {navLinks.map((link) => (
                <SidebarNavItem key={link.href} link={link} onClick={() => setAberto(false)} />
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-4 border-t border-white/10 pt-4">
              <SidebarUsuario nome={usuarioNome} email={usuarioEmail} />
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

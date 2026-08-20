'use client'

import { useState } from 'react'
import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'
import ThemeToggle from './ThemeToggle'
import { ICONES, IconChevron, type IconKey } from './icons'

export type SidebarLink = {
  href: string
  label: string
  icon: IconKey
  subLinks?: { href: string; label: string }[]
  badge?: number
}

export function estaAtivo(pathname: string, href: string) {
  const segmentos = href.split('/').filter(Boolean)
  if (segmentos.length <= 1) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? '')
  return letras.join('') || '?'
}

export function SidebarNavItem({ link, onClick }: { link: SidebarLink; onClick?: () => void }) {
  const pathname = usePathname()
  const Icon = ICONES[link.icon]

  const ativoPrincipal = estaAtivo(pathname, link.href)
  const algumSubLinkAtivo = link.subLinks?.some((subLink) => estaAtivo(pathname, subLink.href)) ?? false
  const ativo = ativoPrincipal || algumSubLinkAtivo

  const [expandido, setExpandido] = useState(ativo)

  return (
    <div>
      <div className="flex items-center gap-1">
        <Link
          href={link.href}
          onClick={onClick}
          className={`relative flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${
            ativo ? 'bg-lime/10 text-lime-bright' : 'text-[#c4cbe0] hover:bg-white/5 hover:text-white'
          }`}
        >
          {ativo && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-lime" />}
          <Icon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{link.label}</span>
          {!!link.badge && (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[10px] font-semibold text-white">
              {link.badge}
            </span>
          )}
        </Link>

        {link.subLinks && link.subLinks.length > 0 && (
          <button
            type="button"
            onClick={() => setExpandido((atual) => !atual)}
            aria-expanded={expandido}
            aria-label={expandido ? `Recolher ${link.label}` : `Expandir ${link.label}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#c4cbe0] transition-colors duration-200 hover:bg-white/5 hover:text-white"
          >
            <IconChevron
              className={`h-3.5 w-3.5 transition-transform duration-200 ${expandido ? 'rotate-90' : ''}`}
            />
          </button>
        )}
      </div>

      {link.subLinks && link.subLinks.length > 0 && expandido && (
        <div className="ml-8 mt-1 flex flex-col border-l border-white/10 pl-3">
          {link.subLinks.map((subLink) => {
            const subLinkAtivo = estaAtivo(pathname, subLink.href)
            return (
              <Link
                key={subLink.href}
                href={subLink.href}
                onClick={onClick}
                className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
                  subLinkAtivo ? 'text-lime-bright' : 'text-[#98a1c2] hover:text-white'
                }`}
              >
                {subLink.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SidebarUsuario({ nome, email }: { nome: string; email?: string | null }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime font-mono text-[12px] font-semibold text-navy">
        {iniciais(nome)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{nome}</p>
        {email && <p className="truncate text-xs text-[#8f9ac0]">{email}</p>}
      </div>
    </div>
  )
}

export default function Sidebar({
  logoSrc,
  titulo,
  subtitulo,
  links,
  usuarioNome,
  usuarioEmail,
  extra,
}: {
  logoSrc: StaticImageData
  titulo: string
  subtitulo?: string
  links: SidebarLink[]
  usuarioNome: string
  usuarioEmail?: string | null
  extra?: React.ReactNode
}) {
  return (
    <aside className="hidden w-[260px] shrink-0 flex-col bg-navy md:flex">
      {/* Altura sempre automática (sem h-* fixo) — cresce com o texto do
          título em vez de cortar ou vazar sobre a nav/conteúdo abaixo. */}
      <div className="relative flex min-w-0 flex-col items-center gap-2 border-b border-rule bg-paper px-6 pt-7 pb-6 text-center">
        <ThemeToggle className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-navy-soft transition-colors duration-200 hover:bg-paper-dim hover:text-navy" />
        <Image src={logoSrc} alt="Opção Contábil" priority className="h-20 w-auto shrink-0" />
        <div className="min-w-0 w-full">
          <p
            title={titulo}
            className="line-clamp-2 overflow-hidden break-words text-sm font-semibold text-navy"
          >
            {titulo}
          </p>
          {subtitulo && (
            <p
              title={subtitulo}
              className="mt-0.5 truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-navy-soft"
            >
              {subtitulo}
            </p>
          )}
        </div>
        {/* Slot genérico — hoje só usado pelo Portal pra mostrar o seletor
            de empresa (SeletorEmpresa.tsx), condicional a 2+ empresas
            vinculadas ao login. O Admin não passa nada aqui, então fica
            visualmente idêntico ao que já era. */}
        {extra}
      </div>

      <nav className="sidebar-scroll mt-7 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-6">
        {links.map((link) => (
          <SidebarNavItem key={link.href} link={link} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4 border-t border-white/10 px-6 pt-4 pb-6">
        <SidebarUsuario nome={usuarioNome} email={usuarioEmail} />
        <LogoutButton />
      </div>
    </aside>
  )
}

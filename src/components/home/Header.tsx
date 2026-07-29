import Image from 'next/image'
import Link from 'next/link'
import HeaderMobileMenu from './HeaderMobileMenu'
import logoSimbolo from '../../../public/images/logo-simbolo.png'

const navLinks = [
  { href: '#servicos', label: 'Serviços' },
  { href: '#sobre', label: 'Sobre' },
  { href: '#diferencial', label: 'Diferencial' },
  { href: '#contato', label: 'Contato' },
]

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <Image src={logoSimbolo} alt="Opção Contábil" priority className="h-16 w-auto shrink-0" />
          <div className="font-display text-lg font-semibold text-navy">
            Opção Contábil
            <span className="mt-0.5 block font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-lime">
              Contabilidade &amp; Gestão Fiscal
            </span>
          </div>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative py-1 text-[14.5px] font-medium text-navy-soft"
            >
              {link.label}
              <span className="absolute bottom-[-2px] left-0 h-[1.5px] w-0 bg-lime transition-[width] duration-[250ms] ease-out group-hover:w-full" />
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-[3px] border-[1.3px] border-navy px-5 py-2.5 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper"
          >
            Portal do Cliente
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)]"
          >
            Painel do Contador
          </Link>
        </div>

        <HeaderMobileMenu />
      </div>
    </header>
  )
}

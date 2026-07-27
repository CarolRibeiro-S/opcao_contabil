import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/admin/LogoutButton'
import logo from '../../../public/images/logo.jpg'

const navLinks = [
  { href: '/admin/clientes', label: 'Clientes', icon: '👥' },
  { href: '/admin/tarefas', label: 'Tarefas', icon: '✓' },
  { href: '/admin/prazos', label: 'Prazos', icon: '⏰' },
  { href: '/admin/cobrancas', label: 'Cobranças', icon: '💰' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/portal')
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-[240px] shrink-0 flex-col bg-navy p-6">
        <div className="mb-10">
          <Image src={logo} alt="Opção Contábil" className="h-9 w-auto" />
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-lime">
            Painel Administrativo
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-[#c4cbe0] transition-colors duration-200 hover:bg-white/5 hover:text-white"
            >
              <span aria-hidden="true">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/15 pt-4">
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}

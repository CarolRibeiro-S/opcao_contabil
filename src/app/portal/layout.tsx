import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminMobileNav from '@/components/admin/AdminMobileNav'
import Sidebar, { type SidebarLink } from '@/components/shared/Sidebar'
import logo from '../../../public/images/logo-simbolo.png'

const navLinks: SidebarLink[] = [
  { href: '/portal', label: 'Início', icon: 'inicio' },
  { href: '/portal/prazos', label: 'Prazos', icon: 'prazos' },
  { href: '/portal/comunicados', label: 'Comunicados', icon: 'comunicados' },
  { href: '/portal/documentos', label: 'Documentos', icon: 'documentos' },
  { href: '/portal/cobrancas', label: 'Honorários Contábeis', icon: 'honorarios' },
]

export default async function PortalLayout({
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

  if (profile?.role === 'admin') {
    redirect('/admin')
  }

  const { data: cliente } = await supabase
    .from('clientes')
    .select('nome_empresa')
    .eq('profile_id', user.id)
    .single()

  const usuarioNome = cliente?.nome_empresa ?? 'Cliente'

  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      <AdminMobileNav
        logo={logo}
        titulo={cliente?.nome_empresa ?? 'Portal do Cliente'}
        subtitulo="Portal do Cliente"
        navLinks={navLinks}
        usuarioNome={usuarioNome}
        usuarioEmail={user.email}
      />

      <Sidebar
        logoSrc={logo}
        titulo={cliente?.nome_empresa ?? 'Portal do Cliente'}
        subtitulo="Portal do Cliente"
        links={navLinks}
        usuarioNome={usuarioNome}
        usuarioEmail={user.email}
      />

      <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
    </div>
  )
}

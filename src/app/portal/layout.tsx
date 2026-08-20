import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClienteAtual } from '@/lib/portal/getClienteAtual'
import AdminMobileNav from '@/components/admin/AdminMobileNav'
import Sidebar, { type SidebarLink } from '@/components/shared/Sidebar'
import SeletorEmpresa from '@/components/portal/SeletorEmpresa'
import logo from '../../../public/images/logo-simbolo.png'

const navLinks: SidebarLink[] = [
  { href: '/portal', label: 'Dashboard', icon: 'inicio' },
  { href: '/portal/prazos', label: 'Prazos', icon: 'prazos' },
  { href: '/portal/comunicados', label: 'Comunicados', icon: 'comunicados' },
  { href: '/portal/documentos', label: 'Documentos', icon: 'documentos' },
  { href: '/portal/solicitacao-mensal', label: 'Solicitação Mensal', icon: 'envioMensal' },
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

  // getClienteAtual() já faz a própria checagem de sessão (redundante com o
  // getUser() acima, mas é o mesmo padrão já usado nas 6 páginas do Portal
  // — não vale a pena desconstruir isso só aqui). cliente é a empresa
  // ATIVA (pelo cookie, ou a primeira da lista); todosClientes é a lista
  // completa, usada só pra decidir se mostra o seletor.
  const { cliente, todosClientes } = await getClienteAtual()

  const usuarioNome = cliente?.nome_empresa ?? 'Cliente'

  const seletorEmpresa =
    cliente && todosClientes.length > 1 ? (
      <SeletorEmpresa clientes={todosClientes} clienteAtivoId={cliente.id} />
    ) : undefined

  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      <AdminMobileNav
        logo={logo}
        titulo={cliente?.nome_empresa ?? 'Portal do Cliente'}
        subtitulo="Portal do Cliente"
        navLinks={navLinks}
        usuarioNome={usuarioNome}
        usuarioEmail={user.email}
        extra={seletorEmpresa}
      />

      <Sidebar
        logoSrc={logo}
        titulo={cliente?.nome_empresa ?? 'Portal do Cliente'}
        subtitulo="Portal do Cliente"
        links={navLinks}
        usuarioNome={usuarioNome}
        usuarioEmail={user.email}
        extra={seletorEmpresa}
      />

      {/* pt-16 (64px) no desktop = md:p-8 (32px) de antes + 32px a mais, pra
          descer o título até ficar mais no centro vertical da faixa branca
          do cabeçalho da sidebar. px/pb continuam em 32px (md:p-8) — só o
          topo mudou, por isso vai separado em vez de usar md:p-8 sozinho. */}
      <main className="flex-1 overflow-x-hidden p-6 md:px-8 md:pb-8 md:pt-16">{children}</main>
    </div>
  )
}

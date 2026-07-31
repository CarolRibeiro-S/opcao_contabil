import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminMobileNav from '@/components/admin/AdminMobileNav'
import Sidebar, { type SidebarLink } from '@/components/shared/Sidebar'
import logo from '../../../public/images/logo-simbolo.png'

// Associa cada item do menu ao módulo correspondente em profiles.permissoes.
// Usado tanto pra filtrar o que aparece na sidebar quanto pra bloquear acesso
// direto por URL a um módulo que o usuário não tem permissão de ver.
const MODULO_POR_HREF: Record<string, string> = {
  '/admin/dashboard': 'dashboard',
  '/admin/clientes': 'clientes',
  '/admin/envio-mensal': 'envio-mensal',
  '/admin/tarefas': 'tarefas',
  '/admin/prazos': 'prazos',
  '/admin/cobrancas': 'cobrancas',
  '/admin/equipe': 'equipe',
}

const navLinks: SidebarLink[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  {
    href: '/admin/clientes',
    label: 'Clientes',
    icon: 'clientes',
    subLinks: [{ href: '/admin/clientes/novo', label: 'Cadastrar novo' }],
  },
  {
    href: '/admin/envio-mensal',
    label: 'Envio de Docs Mensais',
    icon: 'envioMensal',
    subLinks: [{ href: '/admin/envio-mensal', label: 'Novo envio' }],
  },
  {
    href: '/admin/tarefas',
    label: 'Tarefas',
    icon: 'tarefas',
    subLinks: [{ href: '/admin/tarefas/nova', label: 'Nova tarefa' }],
  },
  {
    href: '/admin/prazos',
    label: 'Prazos',
    icon: 'prazos',
    subLinks: [{ href: '/admin/prazos/novo', label: 'Novo prazo' }],
  },
  {
    href: '/admin/cobrancas',
    label: 'Honorários Contábeis',
    icon: 'honorarios',
    subLinks: [{ href: '/admin/cobrancas/nova', label: 'Novo honorário' }],
  },
  {
    href: '/admin/financeiro',
    label: 'Financeiro',
    icon: 'financeiro',
    subLinks: [
      { href: '/admin/financeiro/dashboard', label: 'Dashboard' },
      { href: '/admin/financeiro/despesas', label: 'Despesas' },
      { href: '/admin/financeiro/receitas', label: 'Receitas' },
      { href: '/admin/financeiro/dre', label: 'DRE' },
    ],
  },
  {
    href: '/admin/equipe',
    label: 'Equipe',
    icon: 'equipe',
    subLinks: [{ href: '/admin/equipe/novo', label: 'Convidar membro' }],
  },
  { href: '/admin/historico', label: 'Histórico', icon: 'historico' },
]

function encontrarModulo(pathname: string) {
  const entrada = Object.entries(MODULO_POR_HREF).find(
    ([href]) => pathname === href || pathname.startsWith(`${href}/`)
  )
  return entrada?.[1]
}

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
    .select('role, nome, permissoes, status')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/portal')
  }

  if (profile.status === 'inativo') {
    await supabase.auth.signOut()
    redirect('/login?erro=inativo')
  }

  const permissoes = profile.permissoes as string[] | null

  const navLinksPermitidos =
    permissoes === null
      ? navLinks
      : navLinks.filter((link) => {
          const modulo = MODULO_POR_HREF[link.href]
          return !modulo || permissoes.includes(modulo)
        })

  // Proteção por URL, não só visual: se a rota atual corresponde a um módulo
  // fora da lista de permissões do usuário, redireciona antes de renderizar
  // a página. O pathname chega via header injetado no middleware (App
  // Router não passa isso pra layouts Server Component diretamente).
  if (permissoes !== null) {
    const headersList = await headers()
    const pathnameAtual = headersList.get('x-pathname') ?? ''
    const moduloAtual = encontrarModulo(pathnameAtual)

    if (moduloAtual && !permissoes.includes(moduloAtual)) {
      const destino = permissoes.includes('dashboard')
        ? '/admin/dashboard'
        : (navLinks.find((link) => {
            const modulo = MODULO_POR_HREF[link.href]
            return modulo && permissoes.includes(modulo)
          })?.href ?? '/login')

      redirect(destino)
    }
  }

  const usuarioNome = profile?.nome ?? user.email ?? 'Administrador'

  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      <AdminMobileNav
        logo={logo}
        titulo="Painel Administrativo"
        navLinks={navLinksPermitidos}
        usuarioNome={usuarioNome}
        usuarioEmail={user.email}
      />

      <Sidebar
        logoSrc={logo}
        titulo="Painel Administrativo"
        links={navLinksPermitidos}
        usuarioNome={usuarioNome}
        usuarioEmail={user.email}
      />

      <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
    </div>
  )
}

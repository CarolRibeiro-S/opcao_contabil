import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminMobileNav from '@/components/admin/AdminMobileNav'
import NotificacoesRespostas from '@/components/admin/NotificacoesRespostas'
import NotificacoesVisualizacoes from '@/components/admin/NotificacoesVisualizacoes'
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
    href: '/admin/comunicados',
    label: 'Comunicados',
    icon: 'comunicados',
    subLinks: [{ href: '/admin/comunicados/novo', label: 'Novo comunicado' }],
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
  { href: '/admin/controle-envios', label: 'Controle de Envios', icon: 'visualizacoes' },
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

  // status='respondido' = cliente respondeu por último e o admin ainda não
  // tratou essa conversa (viu, respondeu de volta ou marcou como concluída).
  const { count: comunicadosRespondidos } = await supabase
    .from('comunicados')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'respondido')

  const navLinksPermitidos = (
    permissoes === null
      ? navLinks
      : navLinks.filter((link) => {
          const modulo = MODULO_POR_HREF[link.href]
          return !modulo || permissoes.includes(modulo)
        })
  ).map((link) =>
    // Só entra o badge se houver pelo menos 1 — 0 não deve aparecer como
    // "0" no menu, então não seta a prop badge nesse caso (undefined).
    link.href === '/admin/comunicados' && comunicadosRespondidos
      ? { ...link, badge: comunicadosRespondidos }
      : link
  )

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

      {/* pt-16 (64px) no desktop = md:p-8 (32px) de antes + 32px a mais, pra
          descer o título até ficar mais no centro vertical da faixa branca
          do cabeçalho da sidebar. px/pb continuam em 32px (md:p-8) — só o
          topo mudou, por isso vai separado em vez de usar md:p-8 sozinho. */}
      <main className="flex-1 overflow-x-hidden p-6 md:px-8 md:pb-8 md:pt-16">
        <NotificacoesRespostas />
        <NotificacoesVisualizacoes />
        {children}
      </main>
    </div>
  )
}

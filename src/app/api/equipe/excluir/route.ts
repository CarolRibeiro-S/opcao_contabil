import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabaseAuth = await createClient()

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { data: profile } = await supabaseAuth.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body.id !== 'string' || !body.id) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  if (body.id === user.id) {
    return NextResponse.json({ error: 'Você não pode excluir sua própria conta.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', body.id)

  if (profileError) {
    return NextResponse.json({ error: 'Não foi possível excluir o membro.' }, { status: 500 })
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(body.id)

  if (authError) {
    return NextResponse.json(
      {
        error:
          'O cadastro foi removido, mas houve um erro ao excluir o acesso de login. Contate o suporte técnico.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ sucesso: true })
}

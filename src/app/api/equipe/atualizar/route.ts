import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CHAVES_MODULOS_ADMIN } from '@/lib/constants/modulosAdmin'

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

  const atualizacao: Record<string, unknown> = {}

  if (body.nome !== undefined) {
    if (typeof body.nome !== 'string' || !body.nome.trim()) {
      return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 })
    }
    atualizacao.nome = body.nome.trim()
  }

  if (body.telefone !== undefined) {
    atualizacao.telefone = typeof body.telefone === 'string' && body.telefone.trim() ? body.telefone.trim() : null
  }

  if (body.cargo !== undefined) {
    atualizacao.cargo = typeof body.cargo === 'string' && body.cargo.trim() ? body.cargo.trim() : null
  }

  if (body.permissoes !== undefined) {
    if (body.permissoes === null) {
      atualizacao.permissoes = null
    } else if (
      Array.isArray(body.permissoes) &&
      body.permissoes.every((item: unknown) => typeof item === 'string' && CHAVES_MODULOS_ADMIN.includes(item))
    ) {
      atualizacao.permissoes =
        body.permissoes.length === CHAVES_MODULOS_ADMIN.length ? null : body.permissoes
    } else {
      return NextResponse.json({ error: 'Lista de permissões inválida.' }, { status: 400 })
    }
  }

  if (body.status !== undefined) {
    if (body.status !== 'ativo' && body.status !== 'inativo') {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
    }

    if (body.id === user.id) {
      return NextResponse.json({ error: 'Você não pode inativar sua própria conta.' }, { status: 400 })
    }

    atualizacao.status = body.status
  }

  if (Object.keys(atualizacao).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin.from('profiles').update(atualizacao).eq('id', body.id)

  if (error) {
    return NextResponse.json({ error: 'Não foi possível salvar as alterações.' }, { status: 500 })
  }

  return NextResponse.json({ sucesso: true })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registrarHistorico, ACOES_HISTORICO, ENTIDADES_HISTORICO, type AcaoHistorico, type EntidadeHistorico } from '@/lib/historico'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role, nome').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)

  if (
    !body ||
    !ACOES_HISTORICO.includes(body.acao) ||
    !ENTIDADES_HISTORICO.includes(body.entidade) ||
    typeof body.entidadeId !== 'string' ||
    !body.entidadeId ||
    typeof body.entidadeNome !== 'string' ||
    !body.entidadeNome
  ) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  await registrarHistorico({
    usuarioId: user.id,
    // O nome vem do profile do usuário JÁ AUTENTICADO nesta requisição, não
    // do corpo enviado pelo navegador — evita que alguém registre uma ação
    // em nome de outra pessoa.
    usuarioNome: profile?.nome ?? user.email ?? 'Administrador',
    acao: body.acao as AcaoHistorico,
    entidade: body.entidade as EntidadeHistorico,
    entidadeId: body.entidadeId,
    entidadeNome: body.entidadeNome,
    detalhes: typeof body.detalhes === 'string' ? body.detalhes : null,
  })

  return NextResponse.json({ sucesso: true })
}

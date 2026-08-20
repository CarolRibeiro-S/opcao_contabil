import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { COOKIE_CLIENTE_ATIVO } from '@/lib/portal/getClienteAtual'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body.clienteId !== 'string' || !body.clienteId) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  // Confirma que essa empresa é mesmo deste login antes de gravar o
  // cookie — nunca confia às cegas no valor vindo do cliente (mesmo que,
  // por construção, getClienteAtual() já ignore com segurança um cookie
  // apontando pra uma empresa que não é do usuário, checar aqui evita
  // gravar um cookie "confuso" e dá um erro claro em vez de silencioso).
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .eq('id', body.clienteId)
    .maybeSingle()

  if (!cliente) {
    return NextResponse.json({ error: 'Essa empresa não está vinculada a este login.' }, { status: 403 })
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_CLIENTE_ATIVO, cliente.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return NextResponse.json({ sucesso: true })
}

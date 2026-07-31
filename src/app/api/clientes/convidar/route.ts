import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarHistorico } from '@/lib/historico'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabaseAuth = await createClient()

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { data: profile } = await supabaseAuth.from('profiles').select('role, nome').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body.cliente_id !== 'string' || !body.cliente_id) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const clienteId = body.cliente_id

  const supabaseAdmin = createAdminClient()

  const { data: cliente, error: clienteError } = await supabaseAdmin
    .from('clientes')
    .select('nome_empresa, email, profile_id')
    .eq('id', clienteId)
    .single()

  if (clienteError || !cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  if (!cliente.email) {
    return NextResponse.json({ error: 'Cliente sem e-mail cadastrado.' }, { status: 400 })
  }

  if (cliente.profile_id) {
    return NextResponse.json({ error: 'Cliente já tem acesso ao portal.' }, { status: 400 })
  }

  try {
    const { data: convite, error: conviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      cliente.email,
      {
        data: { nome: cliente.nome_empresa, tipo: 'cliente' },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/definir-senha`,
      }
    )

    if (conviteError || !convite.user) {
      console.error('[api/clientes/convidar] Erro ao chamar inviteUserByEmail:', conviteError)

      const jaExiste =
        conviteError?.status === 422 || (conviteError?.message ?? '').toLowerCase().includes('already')

      return NextResponse.json(
        {
          error: jaExiste
            ? 'Já existe um usuário cadastrado com esse e-mail.'
            : 'Não foi possível enviar o convite. Tente novamente.',
          detalhes: conviteError?.message ?? 'inviteUserByEmail não retornou usuário nem erro.',
        },
        { status: jaExiste ? 409 : 500 }
      )
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: convite.user.id,
      nome: cliente.nome_empresa,
      email: cliente.email,
      role: 'cliente',
    })

    if (profileError) {
      console.error('[api/clientes/convidar] Erro ao gravar profile:', profileError)

      return NextResponse.json(
        {
          error: 'O convite foi enviado, mas houve um erro ao salvar os dados de acesso.',
          detalhes: profileError.message,
        },
        { status: 500 }
      )
    }

    const { error: vinculoError } = await supabaseAdmin
      .from('clientes')
      .update({ profile_id: convite.user.id })
      .eq('id', clienteId)

    if (vinculoError) {
      console.error('[api/clientes/convidar] Erro ao vincular profile_id ao cliente:', vinculoError)

      return NextResponse.json(
        {
          error: 'O convite foi enviado, mas houve um erro ao vincular o acesso a este cliente.',
          detalhes: vinculoError.message,
        },
        { status: 500 }
      )
    }

    await registrarHistorico({
      usuarioId: user.id,
      usuarioNome: profile?.nome ?? user.email ?? 'Administrador',
      acao: 'convidou',
      entidade: 'cliente',
      entidadeId: clienteId,
      entidadeNome: cliente.nome_empresa,
    })

    return NextResponse.json({ sucesso: true })
  } catch (erroInesperado) {
    console.error('[api/clientes/convidar] Erro inesperado:', erroInesperado)

    const mensagem = erroInesperado instanceof Error ? erroInesperado.message : String(erroInesperado)

    return NextResponse.json(
      { error: 'Erro inesperado ao processar o convite.', detalhes: mensagem },
      { status: 500 }
    )
  }
}

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

  if (
    !body ||
    typeof body.nome !== 'string' ||
    typeof body.email !== 'string' ||
    !body.nome.trim() ||
    !body.email.trim()
  ) {
    return NextResponse.json({ error: 'Nome e e-mail são obrigatórios.' }, { status: 400 })
  }

  const nome = body.nome.trim()
  const email = body.email.trim()
  const telefone = typeof body.telefone === 'string' && body.telefone.trim() ? body.telefone.trim() : null
  const cargo = typeof body.cargo === 'string' && body.cargo.trim() ? body.cargo.trim() : null

  let permissoes: string[] | null = null

  if (body.permissoes !== undefined && body.permissoes !== null) {
    if (
      !Array.isArray(body.permissoes) ||
      !body.permissoes.every((item: unknown) => typeof item === 'string' && CHAVES_MODULOS_ADMIN.includes(item))
    ) {
      return NextResponse.json({ error: 'Lista de permissões inválida.' }, { status: 400 })
    }

    permissoes = body.permissoes.length === CHAVES_MODULOS_ADMIN.length ? null : body.permissoes
  }

  try {
    const supabaseAdmin = createAdminClient()

    const { data: convite, error: conviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { nome },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/definir-senha`,
    })

    if (conviteError || !convite.user) {
      // Log completo pro terminal — o objeto de erro do Supabase costuma ter
      // status/code/name além da message, útil pra diagnosticar o 500 real.
      console.error('[api/equipe/convidar] Erro ao chamar inviteUserByEmail:', conviteError)

      const jaExiste =
        conviteError?.status === 422 || (conviteError?.message ?? '').toLowerCase().includes('already')

      return NextResponse.json(
        {
          error: jaExiste
            ? 'Já existe um usuário cadastrado com esse e-mail.'
            : 'Não foi possível enviar o convite. Tente novamente.',
          // Exposto de propósito pra debug agora — não é pra produção final.
          detalhes: conviteError?.message ?? 'inviteUserByEmail não retornou usuário nem erro.',
        },
        { status: jaExiste ? 409 : 500 }
      )
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: convite.user.id,
        nome,
        email,
        telefone,
        cargo,
        role: 'admin',
        permissoes,
        status: 'ativo',
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      console.error('[api/equipe/convidar] Erro ao gravar profile:', profileError)

      return NextResponse.json(
        {
          error: 'O convite foi enviado, mas houve um erro ao salvar os dados do membro.',
          detalhes: profileError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ sucesso: true })
  } catch (erroInesperado) {
    // Cobre qualquer exceção não prevista (ex: createAdminClient() falhando,
    // erro de rede, etc.) que antes cairia no handler de erro genérico do
    // Next.js sem detalhe nenhum.
    console.error('[api/equipe/convidar] Erro inesperado:', erroInesperado)

    const mensagem = erroInesperado instanceof Error ? erroInesperado.message : String(erroInesperado)

    return NextResponse.json(
      { error: 'Erro inesperado ao processar o convite.', detalhes: mensagem },
      { status: 500 }
    )
  }
}

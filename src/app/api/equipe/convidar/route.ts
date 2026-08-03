import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CHAVES_MODULOS_ADMIN } from '@/lib/constants/modulosAdmin'
import { registrarHistorico } from '@/lib/historico'
import { emailConviteEquipe } from '@/lib/email/templates'

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

    // generateLink({type:'invite'}) no lugar de inviteUserByEmail(): os dois
    // criam o usuário da mesma forma, mas só o generateLink devolve o
    // código OTP (data.properties.email_otp), necessário pra montar um
    // e-mail com código em vez do link mágico clicável de sempre —
    // Gmail/Outlook escaneiam e "visitam" automaticamente links de e-mail
    // por segurança, o que gastava o link de uso único antes do clique real.
    const { data: convite, error: conviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { data: { nome } },
    })

    if (conviteError || !convite.user || !convite.properties?.email_otp) {
      console.error('[api/equipe/convidar] Erro ao chamar generateLink (invite):', conviteError)

      const jaExiste =
        conviteError?.status === 422 || (conviteError?.message ?? '').toLowerCase().includes('already')

      return NextResponse.json(
        {
          error: jaExiste
            ? 'Já existe um usuário cadastrado com esse e-mail.'
            : 'Não foi possível enviar o convite. Tente novamente.',
          detalhes: conviteError?.message ?? 'generateLink não retornou usuário nem código.',
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

    const linkVerificarCodigo = `${process.env.NEXT_PUBLIC_SITE_URL}/verificar-codigo?${new URLSearchParams({
      email,
      tipo: 'invite',
    }).toString()}`

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { subject, html } = emailConviteEquipe({
      nomeDestinatario: nome,
      codigo: convite.properties.email_otp,
      linkVerificarCodigo,
    })

    const { error: emailError } = await resend.emails.send({
      from: 'naoresponda@opcaocontabilbsb.com.br',
      to: email,
      subject,
      html,
    })

    if (emailError) {
      console.error('[api/equipe/convidar] Erro ao enviar e-mail de convite:', emailError)

      return NextResponse.json(
        {
          error: 'O acesso foi criado, mas houve um erro ao enviar o e-mail com o código.',
          detalhes: emailError.message,
        },
        { status: 500 }
      )
    }

    await registrarHistorico({
      usuarioId: user.id,
      usuarioNome: profile?.nome ?? user.email ?? 'Administrador',
      acao: 'convidou',
      entidade: 'membro_equipe',
      entidadeId: convite.user.id,
      entidadeNome: nome,
    })

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

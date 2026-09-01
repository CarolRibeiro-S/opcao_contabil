import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarHistorico } from '@/lib/historico'
import { emailEmpresaVinculada, emailReenvioConvite } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function linkVerificarCodigo(email: string) {
  const params = new URLSearchParams({ email, tipo: 'recovery' })
  return `${process.env.NEXT_PUBLIC_SITE_URL}/verificar-codigo?${params.toString()}`
}

// Corrige o e-mail de ACESSO (auth.users, via profile_id) de um cliente que
// já tem portal ativo — diferente de clientes.email (contato, editado no
// formulário principal), que pode divergir da conta real (ver aviso em
// EditarClienteForm.tsx). Ação administrativa explícita: o admin já viu o
// aviso de divergência e decidiu qual dos dois e-mails está certo.
export async function POST(request: Request) {
  const supabaseAuth = await createClient()

  let {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  // Mesmo fallback via Bearer já usado em /api/clientes/convidar, pra
  // manter o mesmo contrato de autenticação entre as duas rotas.
  if (!user) {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (token) {
      const { data } = await supabaseAuth.auth.getUser(token)
      user = data.user
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient()

  const { data: profile } = await supabaseAdmin.from('profiles').select('role, nome').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body.cliente_id !== 'string' || !body.cliente_id) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const novoEmail = typeof body.novo_email === 'string' ? body.novo_email.trim().toLowerCase() : ''

  if (!novoEmail) {
    return NextResponse.json({ error: 'Informe o novo e-mail de acesso.' }, { status: 400 })
  }

  if (!EMAIL_REGEX.test(novoEmail)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  }

  const clienteId = body.cliente_id

  const { data: cliente, error: clienteError } = await supabaseAdmin
    .from('clientes')
    .select('nome_empresa, profile_id')
    .eq('id', clienteId)
    .single()

  if (clienteError || !cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  if (!cliente.profile_id) {
    return NextResponse.json(
      { error: 'Este cliente ainda não tem acesso ao portal vinculado.' },
      { status: 400 }
    )
  }

  const { data: contaAtual, error: contaAtualError } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', cliente.profile_id)
    .maybeSingle()

  if (contaAtualError || !contaAtual) {
    return NextResponse.json(
      { error: 'Não encontrei a conta de acesso vinculada a este cliente.' },
      { status: 404 }
    )
  }

  if (contaAtual.email === novoEmail) {
    return NextResponse.json({ error: 'Esse já é o e-mail de acesso atual.' }, { status: 400 })
  }

  // Segundo passo do fluxo "e-mail já existe" (ver branch abaixo): o admin
  // já confirmou que o e-mail novo é de outra conta e quer usar ESSA conta
  // pra este cliente em vez de renomear a conta atual — mesmo espírito do
  // vincularContaExistente em /api/clientes/convidar, só que partindo de
  // uma correção de e-mail em vez de um primeiro convite.
  if (body.confirmarVinculo === true) {
    const { data: contaExistente } = await supabaseAdmin
      .from('profiles')
      .select('id, nome')
      .eq('email', novoEmail)
      .maybeSingle()

    if (!contaExistente) {
      return NextResponse.json(
        { error: 'Não encontrei mais a conta existente pra vincular. Tente novamente.' },
        { status: 404 }
      )
    }

    const { error: vinculoError } = await supabaseAdmin
      .from('clientes')
      .update({ profile_id: contaExistente.id })
      .eq('id', clienteId)

    if (vinculoError) {
      return NextResponse.json(
        { error: 'Não foi possível vincular esta empresa à conta existente.', detalhes: vinculoError.message },
        { status: 500 }
      )
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { subject, html } = emailEmpresaVinculada({
      nomeDestinatario: contaExistente.nome ?? cliente.nome_empresa,
      nomeEmpresa: cliente.nome_empresa,
    })

    const { error: emailError } = await resend.emails.send({
      from: 'naoresponda@opcaocontabilbsb.com.br',
      to: novoEmail,
      subject,
      html,
    })

    if (emailError) {
      console.error('[api/clientes/atualizar-email-acesso] Vinculado, mas falhou o e-mail de aviso:', emailError)
    }

    await registrarHistorico({
      usuarioId: user.id,
      usuarioNome: profile?.nome ?? user.email ?? 'Administrador',
      acao: 'convidou',
      entidade: 'cliente',
      entidadeId: clienteId,
      entidadeNome: cliente.nome_empresa,
      detalhes: `E-mail de acesso corrigido para "${novoEmail}" — vinculado à conta existente (já usada por ${contaExistente.nome ?? 'outra empresa'}).`,
    })

    return NextResponse.json({ sucesso: true, vinculado: true, emailAcesso: novoEmail, avisoEmail: !!emailError })
  }

  const emailAntigo = contaAtual.email

  const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(cliente.profile_id, {
    email: novoEmail,
    // Correção administrativa, não autoatendimento: não faz sentido exigir
    // confirmação por e-mail antigo/novo (o cliente nem sabe que isso está
    // acontecendo) — o admin já verificou que é o e-mail certo.
    email_confirm: true,
  })

  if (updateAuthError) {
    // Mesmo tipo de colisão já tratado em /api/clientes/convidar: o e-mail
    // novo já pertence a OUTRA conta confirmada. Em vez de falhar, oferece
    // vincular esta empresa a essa conta (branch confirmarVinculo acima).
    if (updateAuthError.status === 422 || (updateAuthError as { code?: string }).code === 'email_exists') {
      const { data: contaExistente } = await supabaseAdmin
        .from('profiles')
        .select('nome')
        .eq('email', novoEmail)
        .maybeSingle()

      return NextResponse.json(
        {
          error: 'Esse e-mail já pertence a outra conta.',
          jaExisteConta: true,
          contaExistente: { nome: contaExistente?.nome ?? null },
        },
        { status: 409 }
      )
    }

    console.error('[api/clientes/atualizar-email-acesso] Erro ao atualizar e-mail no Auth:', updateAuthError)

    return NextResponse.json(
      { error: 'Não foi possível atualizar o e-mail de acesso. Tente novamente.', detalhes: updateAuthError.message },
      { status: 500 }
    )
  }

  const { error: profileUpdateError } = await supabaseAdmin
    .from('profiles')
    .update({ email: novoEmail })
    .eq('id', cliente.profile_id)

  if (profileUpdateError) {
    console.error('[api/clientes/atualizar-email-acesso] Erro ao sincronizar profiles.email:', profileUpdateError)

    return NextResponse.json(
      {
        error: 'O e-mail foi atualizado no acesso, mas houve um erro ao sincronizar o cadastro. Avise o suporte.',
        detalhes: profileUpdateError.message,
      },
      { status: 500 }
    )
  }

  // Reenvia o código de acesso pro e-mail NOVO — mesma lógica de
  // generateLink(recovery) já usada em "Reenviar convite". Falha aqui não
  // desfaz a correção do e-mail (que já é o resultado mais importante);
  // só avisa que o reenvio não saiu, pro admin usar "Reenviar convite"
  // manualmente depois.
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: novoEmail,
  })

  let reenviado = false
  let avisoReenvio = false

  if (linkError || !linkData?.properties?.email_otp) {
    console.error('[api/clientes/atualizar-email-acesso] E-mail corrigido, mas falhou gerar novo código:', linkError)
    avisoReenvio = true
  } else {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { subject, html } = emailReenvioConvite({
      nomeDestinatario: cliente.nome_empresa,
      codigo: linkData.properties.email_otp,
      linkVerificarCodigo: linkVerificarCodigo(novoEmail),
    })

    const { error: emailError } = await resend.emails.send({
      from: 'naoresponda@opcaocontabilbsb.com.br',
      to: novoEmail,
      subject,
      html,
    })

    if (emailError) {
      console.error('[api/clientes/atualizar-email-acesso] E-mail corrigido, mas falhou enviar o código:', emailError)
      avisoReenvio = true
    } else {
      reenviado = true
    }
  }

  await registrarHistorico({
    usuarioId: user.id,
    usuarioNome: profile?.nome ?? user.email ?? 'Administrador',
    acao: 'convidou',
    entidade: 'cliente',
    entidadeId: clienteId,
    entidadeNome: cliente.nome_empresa,
    detalhes: `E-mail de acesso corrigido de "${emailAntigo}" para "${novoEmail}"${reenviado ? ' e novo código enviado.' : ' (reenvio do código falhou).'}`,
  })

  return NextResponse.json({ sucesso: true, emailAcesso: novoEmail, reenviado, avisoReenvio })
}

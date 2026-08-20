import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarHistorico } from '@/lib/historico'
import { emailConvitePortalCliente, emailEmpresaVinculada, emailReenvioConvite } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

// Link pra nossa própria página de verificação — NÃO é o link mágico do
// Supabase (esse nunca vai pro e-mail, de propósito: ver comentário mais
// abaixo). Levar o tipo na querystring evita que /verificar-codigo precise
// "adivinhar" entre invite/recovery.
function linkVerificarCodigo(email: string, tipo: 'invite' | 'recovery') {
  const params = new URLSearchParams({ email, tipo })
  return `${process.env.NEXT_PUBLIC_SITE_URL}/verificar-codigo?${params.toString()}`
}

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

  // Segundo passo do fluxo "e-mail já existe" (ver branch jaExiste mais
  // abaixo): o admin já confirmou explicitamente que é a mesma pessoa —
  // vincula esta empresa à conta existente em vez de criar um usuário
  // novo. Re-busca o profile pelo e-mail aqui de novo (não confia no que
  // o front mandou) — evita vincular a um profile_id arbitrário caso o
  // corpo da requisição seja manipulado.
  if (body.vincularContaExistente === true) {
    const { data: contaExistente } = await supabaseAdmin
      .from('profiles')
      .select('id, nome')
      .eq('email', cliente.email)
      .maybeSingle()

    if (!contaExistente) {
      return NextResponse.json(
        { error: 'Não encontrei mais a conta existente pra vincular. Tente convidar de novo.' },
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
      to: cliente.email,
      subject,
      html,
    })

    if (emailError) {
      console.error('[api/clientes/convidar] Empresa vinculada, mas falhou o e-mail de aviso:', emailError)
    }

    await registrarHistorico({
      usuarioId: user.id,
      usuarioNome: profile?.nome ?? user.email ?? 'Administrador',
      acao: 'convidou',
      entidade: 'cliente',
      entidadeId: clienteId,
      entidadeNome: cliente.nome_empresa,
      detalhes: `Vinculado à conta existente (mesmo e-mail já usado por ${contaExistente.nome ?? 'outra empresa'}).`,
    })

    return NextResponse.json({ sucesso: true, vinculado: true, avisoEmail: !!emailError })
  }

  // Cliente já tem conta no portal (profile_id vinculado) — o código/link
  // original pode ter expirado, então reenviamos em vez de dar erro. Não dá
  // pra usar generateLink({type:'invite'}) aqui: esse tipo cria um usuário
  // NOVO e bateria no mesmo erro "já existe" tratado mais abaixo pro caso de
  // colisão de e-mail entre clientes diferentes. O equivalente certo do
  // Supabase Auth pra usuário já existente é generateLink({type:'recovery'}).
  if (cliente.profile_id) {
    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: cliente.email,
      })

      if (linkError || !linkData?.properties?.email_otp) {
        console.error('[api/clientes/convidar] Erro ao gerar código de reenvio:', linkError)

        return NextResponse.json(
          {
            error: 'Não foi possível gerar um novo código de acesso. Tente novamente.',
            detalhes: linkError?.message ?? 'generateLink não retornou email_otp.',
          },
          { status: 500 }
        )
      }

      const resend = new Resend(process.env.RESEND_API_KEY)
      const { subject, html } = emailReenvioConvite({
        nomeDestinatario: cliente.nome_empresa,
        codigo: linkData.properties.email_otp,
        linkVerificarCodigo: linkVerificarCodigo(cliente.email, 'recovery'),
      })

      const { error: emailError } = await resend.emails.send({
        from: 'naoresponda@opcaocontabilbsb.com.br',
        to: cliente.email,
        subject,
        html,
      })

      if (emailError) {
        console.error('[api/clientes/convidar] Erro ao enviar e-mail de reenvio:', emailError)

        return NextResponse.json(
          { error: 'Não foi possível enviar o e-mail com o novo código. Tente novamente.' },
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
        detalhes: 'Reenvio de convite — cliente já tinha acesso ao portal, código original pode ter expirado.',
      })

      return NextResponse.json({ sucesso: true, reenviado: true })
    } catch (erroInesperado) {
      console.error('[api/clientes/convidar] Erro inesperado no reenvio:', erroInesperado)

      const mensagem = erroInesperado instanceof Error ? erroInesperado.message : String(erroInesperado)

      return NextResponse.json(
        { error: 'Erro inesperado ao reenviar o convite.', detalhes: mensagem },
        { status: 500 }
      )
    }
  }

  try {
    // generateLink({type:'invite'}) no lugar de inviteUserByEmail(): os dois
    // criam o usuário da mesma forma, mas só o generateLink devolve o
    // código OTP (data.properties.email_otp) pra gente montar o e-mail
    // customizado — inviteUserByEmail dispara o e-mail padrão do Supabase
    // sozinho, sem expor o código, sem chance de mostrar o código em vez do
    // link mágico clicável (o problema que estamos resolvendo aqui).
    const { data: convite, error: conviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: cliente.email,
      options: {
        data: { nome: cliente.nome_empresa, tipo: 'cliente' },
      },
    })

    if (conviteError || !convite.user || !convite.properties?.email_otp) {
      console.error('[api/clientes/convidar] Erro ao chamar generateLink (invite):', conviteError)

      return NextResponse.json(
        {
          error: 'Não foi possível enviar o convite. Tente novamente.',
          detalhes: conviteError?.message ?? 'generateLink não retornou usuário nem código.',
        },
        { status: 500 }
      )
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: convite.user.id,
      nome: cliente.nome_empresa,
      email: cliente.email,
      role: 'cliente',
    })

    if (profileError) {
      // Testado direto contra o Supabase Auth: generateLink({type:'invite'})
      // NÃO falha pra e-mail que já tem conta — ele devolve o MESMO usuário
      // existente de novo, sem erro nenhum. É só aqui, no insert de
      // profiles (chave primária = auth user id), que a colisão realmente
      // aparece — código 23505 (unique_violation). Antes disso rodava uma
      // checagem no erro do generateLink que nunca disparava de verdade.
      if (profileError.code === '23505') {
        // Provavelmente outra empresa do mesmo dono, já convidada antes —
        // em vez de só rejeitar, busca essa conta e devolve pro front
        // oferecer o vínculo. NUNCA vincula automaticamente: e-mail
        // coincidente entre clientes DIFERENTES é possível (endereço
        // genérico compartilhado por engano, por exemplo), e vincular
        // errado vazaria dados de um cliente pro outro — precisa de
        // confirmação explícita do admin (branch vincularContaExistente,
        // no topo da rota).
        const { data: contaExistente } = await supabaseAdmin
          .from('profiles')
          .select('nome')
          .eq('id', convite.user.id)
          .maybeSingle()

        return NextResponse.json(
          {
            error: 'Já existe uma conta com esse e-mail.',
            jaExisteConta: true,
            contaExistente: { nome: contaExistente?.nome ?? null },
          },
          { status: 409 }
        )
      }

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

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { subject, html } = emailConvitePortalCliente({
      nomeDestinatario: cliente.nome_empresa,
      codigo: convite.properties.email_otp,
      linkVerificarCodigo: linkVerificarCodigo(cliente.email, 'invite'),
    })

    const { error: emailError } = await resend.emails.send({
      from: 'naoresponda@opcaocontabilbsb.com.br',
      to: cliente.email,
      subject,
      html,
    })

    if (emailError) {
      console.error('[api/clientes/convidar] Erro ao enviar e-mail de convite:', emailError)

      return NextResponse.json(
        {
          error: 'O acesso foi criado, mas houve um erro ao enviar o e-mail com o código. Use "Reenviar convite".',
          detalhes: emailError.message,
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

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailNovaMensagemComunicado } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

// Chamada pelo ThreadComunicado (Admin e Portal) depois que uma mensagem já
// foi salva com sucesso em mensagens_comunicado — o e-mail é um bônus, nunca
// deve travar a tela se falhar (por isso todo erro aqui vira console.error
// detalhado em vez de propagar pra quebrar a experiência de quem só queria
// mandar uma mensagem).
export async function POST(request: Request) {
  const supabaseAuth = await createClient()

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body.mensagemId !== 'string' || !body.mensagemId) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const mensagemId = body.mensagemId as string
  const supabaseAdmin = createAdminClient()

  const { data: mensagem, error: mensagemError } = await supabaseAdmin
    .from('mensagens_comunicado')
    .select('id, comunicado_id, autor_tipo, autor_nome, mensagem')
    .eq('id', mensagemId)
    .single()

  if (mensagemError || !mensagem) {
    console.error('[api/comunicados/notificar] Mensagem não encontrada:', mensagemError)
    return NextResponse.json({ error: 'Mensagem não encontrada.' }, { status: 404 })
  }

  const { data: comunicado, error: comunicadoError } = await supabaseAdmin
    .from('comunicados')
    .select('id, titulo, cliente_id, enviado_por')
    .eq('id', mensagem.comunicado_id)
    .single()

  if (comunicadoError || !comunicado) {
    console.error('[api/comunicados/notificar] Comunicado não encontrado:', comunicadoError)
    return NextResponse.json({ error: 'Comunicado não encontrado.' }, { status: 404 })
  }

  const { data: cliente, error: clienteError } = await supabaseAdmin
    .from('clientes')
    .select('profile_id, nome_empresa, email')
    .eq('id', comunicado.cliente_id)
    .single()

  if (clienteError || !cliente) {
    console.error('[api/comunicados/notificar] Cliente não encontrado:', clienteError)
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  // Quem pediu a notificação precisa ser ou o admin dono da mensagem, ou o
  // próprio cliente da thread — nunca outro cliente lendo o comunicado de
  // terceiros só por saber o id.
  const { data: profile } = await supabaseAuth.from('profiles').select('role').eq('id', user.id).single()
  const ehAdmin = profile?.role === 'admin'
  const ehDonoDaThread = cliente.profile_id === user.id

  if (!ehAdmin && !ehDonoDaThread) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    if (mensagem.autor_tipo === 'cliente') {
      // Cliente respondeu: avisa quem criou o comunicado (o admin/membro da
      // equipe responsável pela conversa).
      if (!comunicado.enviado_por) {
        console.error(
          '[api/comunicados/notificar] Comunicado sem enviado_por — não há admin pra notificar.',
          comunicado.id
        )
        return NextResponse.json({ sucesso: true, notificado: false, motivo: 'sem_enviado_por' })
      }

      const { data: adminProfile, error: adminError } = await supabaseAdmin
        .from('profiles')
        .select('nome, email')
        .eq('id', comunicado.enviado_por)
        .single()

      if (adminError || !adminProfile?.email) {
        console.error(
          '[api/comunicados/notificar] Não foi possível achar e-mail do admin destinatário:',
          adminError,
          'enviado_por:',
          comunicado.enviado_por
        )
        return NextResponse.json({ sucesso: true, notificado: false, motivo: 'admin_sem_email' })
      }

      const { subject, html } = emailNovaMensagemComunicado({
        nomeDestinatario: adminProfile.nome ?? 'Administrador',
        autorNome: mensagem.autor_nome,
        tituloComunicado: comunicado.titulo,
        mensagem: mensagem.mensagem,
        link: `${siteUrl}/admin/clientes/${comunicado.cliente_id}/editar`,
      })

      const { error: emailError } = await resend.emails.send({
        from: 'naoresponda@opcaocontabilbsb.com.br',
        to: adminProfile.email,
        subject,
        html,
      })

      if (emailError) {
        console.error('[api/comunicados/notificar] Falha ao enviar e-mail pro admin:', emailError)
        return NextResponse.json({ error: 'Falha ao enviar e-mail.', detalhes: emailError.message }, { status: 500 })
      }
    } else {
      // Admin respondeu: avisa o cliente dono do comunicado.
      if (!cliente.email) {
        console.error('[api/comunicados/notificar] Cliente sem e-mail cadastrado:', comunicado.cliente_id)
        return NextResponse.json({ sucesso: true, notificado: false, motivo: 'cliente_sem_email' })
      }

      const { subject, html } = emailNovaMensagemComunicado({
        nomeDestinatario: cliente.nome_empresa,
        autorNome: mensagem.autor_nome,
        tituloComunicado: comunicado.titulo,
        mensagem: mensagem.mensagem,
        link: `${siteUrl}/portal/comunicados`,
      })

      const { error: emailError } = await resend.emails.send({
        from: 'naoresponda@opcaocontabilbsb.com.br',
        to: cliente.email,
        subject,
        html,
      })

      if (emailError) {
        console.error('[api/comunicados/notificar] Falha ao enviar e-mail pro cliente:', emailError)
        return NextResponse.json({ error: 'Falha ao enviar e-mail.', detalhes: emailError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ sucesso: true, notificado: true })
  } catch (erroInesperado) {
    console.error('[api/comunicados/notificar] Erro inesperado:', erroInesperado)
    const mensagemErro = erroInesperado instanceof Error ? erroInesperado.message : String(erroInesperado)
    return NextResponse.json({ error: 'Erro inesperado ao notificar.', detalhes: mensagemErro }, { status: 500 })
  }
}

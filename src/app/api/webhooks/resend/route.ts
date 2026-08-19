import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import type { WebhookEventPayload } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailAlertaFalhaEnvioResend } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

// Só esse endereço recebe esse alerta — é pontual, operacional, e pra fora
// do sistema (e-mail pessoal da Carol). Não tem nenhuma relação com as
// notificações do admin (Hederson) que já existem no Dashboard/banners, e
// não deve aparecer em nenhuma tela do admin nem do portal.
const DESTINATARIO_ALERTA = 'anacarolina.ribeiro.s@gmail.com'

function descreverFalha(evento: WebhookEventPayload): string {
  switch (evento.type) {
    case 'email.bounced':
      return `Bounce (e-mail devolvido) — ${evento.data.bounce.type}: ${evento.data.bounce.message}`
    case 'email.failed':
      return `Falha no despacho — ${evento.data.failed.reason}`
    case 'email.delivery_delayed':
      return 'Entrega atrasada pelo provedor de destino'
    case 'email.complained':
      return 'Destinatário marcou o e-mail como spam'
    default:
      return evento.type
  }
}

// Recebe eventos da Resend sobre o que aconteceu DEPOIS que um e-mail foi
// aceito pra envio — a resposta síncrona de resend.emails.send() só confirma
// que a Resend recebeu o pedido, não que a entrega deu certo (foi
// exatamente esse buraco que causou o bug de cota excedida do dia 15/08,
// ver cron/prazos). Esse webhook cobre o resto: bounces, falhas de
// despacho, atrasos e reclamações de spam, que só a própria Resend sabe
// dizer, e só depois de um tempo.
export async function POST(request: Request) {
  const payload = await request.text()

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 400 })
  }

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[webhooks/resend] RESEND_WEBHOOK_SECRET não configurado.')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  let evento: WebhookEventPayload

  // resend.webhooks.verify() usa o pacote standardwebhooks (já vem junto do
  // SDK da Resend — não precisa instalar nada à parte) pra conferir a
  // assinatura HMAC dos headers svix-* contra o payload bruto (texto, não
  // JSON já parseado — a assinatura é calculada sobre os bytes exatos).
  // Lança se a assinatura não bater; NUNCA processamos um evento não
  // verificado.
  try {
    evento = resend.webhooks.verify({
      payload,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret,
    })
  } catch (erroVerificacao) {
    console.error('[webhooks/resend] Assinatura inválida:', erroVerificacao)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Só os 4 eventos que representam falha real de entrega — os demais
  // (sent, delivered, opened, clicked, etc.) são ignorados aqui de
  // propósito, sem erro: a Resend espera 200 pra qualquer evento recebido,
  // mesmo os que a gente não usa.
  if (
    evento.type !== 'email.bounced' &&
    evento.type !== 'email.failed' &&
    evento.type !== 'email.delivery_delayed' &&
    evento.type !== 'email.complained'
  ) {
    return NextResponse.json({ ok: true, ignorado: true })
  }

  const motivo = descreverFalha(evento)

  // Persiste ANTES de tentar mandar o aviso pessoal — é o registro que
  // alimenta o status de entrega na tela de Honorários (CobrancasTable.tsx),
  // a parte que fica pro Hederson enxergar sozinho, sem depender da Carol.
  // Falha aqui não derruba o resto do webhook: o aviso pessoal continua
  // tentando ser enviado mesmo que a gravação no banco falhe.
  const supabaseAdmin = createAdminClient()

  const { error: insertError } = await supabaseAdmin.from('email_eventos').insert({
    resend_email_id: evento.data.email_id,
    tipo: evento.type.replace(/^email\./, ''),
    detalhe: motivo,
  })

  if (insertError) {
    console.error('[webhooks/resend] Falha ao gravar evento em email_eventos:', insertError)
  }

  const { subject, html } = emailAlertaFalhaEnvioResend({
    destinatarios: evento.data.to.join(', '),
    assuntoOriginal: evento.data.subject,
    motivo,
    dataEventoIso: evento.created_at,
  })

  const { error: emailError } = await resend.emails.send({
    from: 'naoresponda@opcaocontabilbsb.com.br',
    to: DESTINATARIO_ALERTA,
    subject,
    html,
  })

  if (emailError) {
    console.error('[webhooks/resend] Falha ao enviar aviso de falha de entrega:', emailError)
    return NextResponse.json({ error: 'Failed to send alert email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

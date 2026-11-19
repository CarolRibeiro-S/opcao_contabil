import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailCobrancaBoleto } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

// A resposta síncrona de resend.emails.send() só confirma que a Resend
// ACEITOU o e-mail na fila — falhas que só acontecem no despacho em si
// (ex: bounce) nunca aparecem no "error" do send(), só depois, consultando
// o e-mail pelo id (campo last_event). Mesmo padrão já usado em
// src/app/api/cron/prazos/route.ts e src/app/api/envio-mensal/route.ts,
// aplicado aqui após a investigação de 2026-11-19 encontrar o mesmo buraco
// nesta rota: resend_email_id já era salvo, mas nada conferia se o e-mail
// do boleto realmente chegou antes de marcar enviado_email_em.
const EVENTOS_FALHA_ENTREGA = new Set(['failed', 'bounced', 'canceled', 'complained', 'suppressed'])

async function envioRealmenteTeveSucesso(resend: Resend, emailId: string | undefined): Promise<boolean> {
  if (!emailId) return false

  await new Promise((resolve) => setTimeout(resolve, 1500))

  const { data, error } = await resend.emails.get(emailId)

  if (error || !data) {
    console.error(`[api/cobrancas/notificar-boleto] Não foi possível confirmar status de entrega do e-mail ${emailId}:`, error)
    return true
  }

  if (EVENTOS_FALHA_ENTREGA.has(data.last_event)) {
    console.error(`[api/cobrancas/notificar-boleto] E-mail ${emailId} foi aceito mas falhou no despacho (last_event=${data.last_event})`)
    return false
  }

  return true
}

type CobrancaRow = {
  id: string
  competencia: string | null
  valor: number | null
  data_vencimento: string | null
  boleto_nome_arquivo: string | null
  boleto_caminho_arquivo: string | null
  clientes: { nome_empresa: string; email: string | null } | null
}

// Envia (ou reenvia) o e-mail do boleto pro cliente, com o PDF/imagem
// anexado de verdade (não um link) — chamada tanto automaticamente por
// EditarCobrancaForm.tsx (primeira vez que o boleto é anexado) quanto
// manualmente por ReenviarEmailCobranca.tsx (reenvio a pedido do
// Hederson). Por isso não tem nenhuma trava de "já foi enviado antes"
// aqui dentro — essa decisão é de quem chama.
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

  if (!body || typeof body.cobrancaId !== 'string' || !body.cobrancaId) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  const { data: cobranca, error: cobrancaError } = await supabaseAdmin
    .from('cobrancas')
    .select(
      'id, competencia, valor, data_vencimento, boleto_nome_arquivo, boleto_caminho_arquivo, clientes(nome_empresa, email)'
    )
    .eq('id', body.cobrancaId)
    .single<CobrancaRow>()

  if (cobrancaError || !cobranca) {
    console.error('[api/cobrancas/notificar-boleto] Honorário não encontrado:', cobrancaError)
    return NextResponse.json({ error: 'Honorário não encontrado.' }, { status: 404 })
  }

  if (!cobranca.boleto_caminho_arquivo) {
    return NextResponse.json({ error: 'Este honorário ainda não tem boleto anexado.' }, { status: 400 })
  }

  if (!cobranca.clientes?.email) {
    return NextResponse.json({ error: 'Cliente sem e-mail cadastrado.' }, { status: 400 })
  }

  if (!cobranca.competencia || cobranca.valor === null || !cobranca.data_vencimento) {
    return NextResponse.json({ error: 'Honorário sem competência, valor ou vencimento preenchidos.' }, { status: 400 })
  }

  const { data: arquivoBoleto, error: downloadError } = await supabaseAdmin.storage
    .from('documentos-clientes')
    .download(cobranca.boleto_caminho_arquivo)

  if (downloadError || !arquivoBoleto) {
    console.error('[api/cobrancas/notificar-boleto] Erro ao baixar boleto do Storage:', downloadError)
    return NextResponse.json({ error: 'Não foi possível carregar o arquivo do boleto.' }, { status: 500 })
  }

  const bufferBoleto = Buffer.from(await arquivoBoleto.arrayBuffer())

  const { subject, html } = emailCobrancaBoleto({
    nomeCliente: cobranca.clientes.nome_empresa,
    competencia: cobranca.competencia,
    valor: cobranca.valor,
    dataVencimento: cobranca.data_vencimento,
  })

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'naoresponda@opcaocontabilbsb.com.br',
      to: cobranca.clientes.email,
      subject,
      html,
      attachments: [
        {
          filename: cobranca.boleto_nome_arquivo ?? 'boleto.pdf',
          content: bufferBoleto.toString('base64'),
        },
      ],
    })

    if (emailError) {
      console.error('[api/cobrancas/notificar-boleto] Falha ao enviar e-mail:', emailError)
      return NextResponse.json({ error: 'Falha ao enviar o e-mail.', detalhes: emailError.message }, { status: 500 })
    }

    if (!(await envioRealmenteTeveSucesso(resend, emailData?.id))) {
      // NÃO marca enviado_email_em — o boleto continua aparecendo como
      // "E-mail pendente" pro admin (CobrancasTable.tsx já trata isso só
      // com base em enviado_email_em ser null), sinalizando que precisa
      // reenviar. resend_email_id fica salvo mesmo assim, pra auditoria.
      await supabaseAdmin.from('cobrancas').update({ resend_email_id: emailData?.id ?? null }).eq('id', cobranca.id)

      return NextResponse.json(
        { error: 'A Resend aceitou o envio mas não confirmou a entrega (falha no despacho). Tente reenviar.' },
        { status: 500 }
      )
    }

    // resend_email_id é o que cruza esse envio com os eventos de entrega que
    // chegam depois pelo webhook (ver api/webhooks/resend) — sem ele não dá
    // pra saber a qual honorário um bounce/falha se refere. Um reenvio
    // (ReenviarEmailCobranca.tsx) sobrescreve com o id do envio mais recente
    // de propósito: o que importa é o status de entrega da tentativa atual.
    const { error: updateError } = await supabaseAdmin
      .from('cobrancas')
      .update({ enviado_email_em: new Date().toISOString(), resend_email_id: emailData?.id ?? null })
      .eq('id', cobranca.id)

    if (updateError) {
      console.error('[api/cobrancas/notificar-boleto] E-mail enviado, mas falhou ao gravar enviado_email_em:', updateError)
      return NextResponse.json({ sucesso: true, avisoGravacao: true })
    }

    return NextResponse.json({ sucesso: true })
  } catch (erroInesperado) {
    console.error('[api/cobrancas/notificar-boleto] Erro inesperado:', erroInesperado)
    const mensagemErro = erroInesperado instanceof Error ? erroInesperado.message : String(erroInesperado)
    return NextResponse.json({ error: 'Erro inesperado ao notificar.', detalhes: mensagemErro }, { status: 500 })
  }
}

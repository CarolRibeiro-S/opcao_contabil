import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailCobrancaBoleto } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

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

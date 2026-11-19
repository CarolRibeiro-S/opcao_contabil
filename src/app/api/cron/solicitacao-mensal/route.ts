import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { determinarEnviosDoDia, competenciaDoMes } from '@/lib/solicitacaoMensal'
import { emailSolicitacaoMensal } from '@/lib/email/templates'
import { emailTemFormatoValido } from '@/lib/validarEmail'

export const dynamic = 'force-dynamic'

// A resposta síncrona de resend.emails.send() só confirma que a Resend
// ACEITOU o e-mail na fila — falhas que só acontecem no despacho em si
// (ex: bounce) nunca aparecem no "error" do send(), só depois, consultando
// o e-mail pelo id (campo last_event). Mesmo padrão já usado em
// src/app/api/cron/prazos/route.ts e src/app/api/envio-mensal/route.ts.
// Aqui é especialmente importante: o gatilho de disparo é "já existe linha
// em envios_solicitacao_mensal pra essa competência/tipo?" — se a linha
// fosse gravada mesmo com a entrega falhando de verdade, esse cliente
// nunca mais seria notificado no mês (nem pelo reforço do dia 05, nem
// manualmente, porque o sistema entenderia que ele já tinha recebido).
const EVENTOS_FALHA_ENTREGA = new Set(['failed', 'bounced', 'canceled', 'complained', 'suppressed'])

async function envioRealmenteTeveSucesso(resend: Resend, emailId: string | undefined): Promise<boolean> {
  if (!emailId) return false

  await new Promise((resolve) => setTimeout(resolve, 1500))

  const { data, error } = await resend.emails.get(emailId)

  if (error || !data) {
    console.error(`[cron/solicitacao-mensal] Não foi possível confirmar status de entrega do e-mail ${emailId}:`, error)
    return true
  }

  if (EVENTOS_FALHA_ENTREGA.has(data.last_event)) {
    console.error(`[cron/solicitacao-mensal] E-mail ${emailId} foi aceito mas falhou no despacho (last_event=${data.last_event})`)
    return false
  }

  return true
}

type ClienteRow = {
  id: string
  nome_empresa: string
  email: string | null
  emite_notas_fiscais: boolean | null
  possui_empregados: boolean | null
}

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization')

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hoje = new Date()
  const envios = determinarEnviosDoDia(hoje)

  if (envios.length === 0) {
    return NextResponse.json({ enviosDoDia: [], enviados: 0, pulados: 0, semEmail: 0, emailInvalido: 0 })
  }

  const supabase = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)
  const competencia = competenciaDoMes(hoje)
  const linkPortal = `${process.env.NEXT_PUBLIC_SITE_URL}/portal`

  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('id, nome_empresa, email, emite_notas_fiscais, possui_empregados')
    .eq('status', 'ativo')
    .returns<ClienteRow[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let enviados = 0
  let pulados = 0
  let semEmail = 0
  let emailInvalido = 0

  for (const tipo of envios) {
    for (const cliente of clientes ?? []) {
      if (!cliente.email) {
        semEmail += 1
        continue
      }

      if (!emailTemFormatoValido(cliente.email)) {
        emailInvalido += 1
        continue
      }

      const { data: jaEnviado } = await supabase
        .from('envios_solicitacao_mensal')
        .select('id')
        .eq('cliente_id', cliente.id)
        .eq('competencia', competencia)
        .eq('tipo', tipo)
        .maybeSingle()

      if (jaEnviado) {
        pulados += 1
        continue
      }

      const { subject, html } = emailSolicitacaoMensal({
        nomeCliente: cliente.nome_empresa,
        tipo,
        competencia,
        emiteNotasFiscais: cliente.emite_notas_fiscais ?? true,
        possuiEmpregados: !!cliente.possui_empregados,
        linkPortal,
      })

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'naoresponda@opcaocontabilbsb.com.br',
        to: cliente.email,
        subject,
        html,
      })

      if (emailError) continue

      if (!(await envioRealmenteTeveSucesso(resend, emailData?.id))) {
        // NÃO insere a linha — sem ela, jaEnviado continua null pra esse
        // cliente/competência/tipo, então o reforço do dia 05 (ou um
        // reenvio manual) ainda vai tentar notificar de novo.
        continue
      }

      await supabase.from('envios_solicitacao_mensal').insert({
        cliente_id: cliente.id,
        competencia,
        tipo,
        resend_email_id: emailData?.id ?? null,
      })

      enviados += 1
    }
  }

  return NextResponse.json({ enviosDoDia: envios, enviados, pulados, semEmail, emailInvalido })
}

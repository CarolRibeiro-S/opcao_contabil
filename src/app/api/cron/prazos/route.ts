import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailAlertaPrazo, emailAlertaPrazoAntecipado, emailAlertaTarefa, emailResumoDiarioAdmin } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'
// Bump de segurança pro maxDuration padrão da Vercel: a verificação extra
// de entrega (envioRealmenteTeveSucesso) adiciona ~1.5s de espera por
// e-mail antes de confirmar no banco — em dias com muitos alertas, isso
// pode se acumular. Ajuste conforme o plano da Vercel em uso.
export const maxDuration = 60

// A resposta síncrona de resend.emails.send() só confirma que a Resend
// ACEITOU o e-mail na fila — o tipo de retorno de sucesso só tem um campo,
// { id }. Não existe status de entrega nessa resposta. Falhas que só
// acontecem no despacho em si (ex: cota diária excedida) nunca aparecem no
// "error" do send() — só depois, consultando o e-mail pelo id (campo
// last_event). É exatamente esse buraco que causou o bug: um envio que a
// Resend aceitou mas não conseguiu despachar (cota) foi tratado como
// sucesso porque só checávamos o "error" do send().
//
// Por isso, além do erro síncrono (que continua sendo checado antes desta
// função ser chamada), esperamos um instante e conferimos o last_event via
// GET /emails/{id} antes de gravar qualquer coisa no banco. 'failed',
// 'bounced', 'canceled', 'complained' e 'suppressed' são os estados que a
// própria Resend documenta como terminais de falha — qualquer um desses
// bloqueia a gravação. Os demais (queued/scheduled/sent/delivered/
// opened/clicked/delivery_delayed) são tratados como "o envio está de pé",
// mesmo comportamento de antes.
const EVENTOS_FALHA_ENTREGA = new Set(['failed', 'bounced', 'canceled', 'complained', 'suppressed'])

async function envioRealmenteTeveSucesso(resend: Resend, emailId: string | undefined): Promise<boolean> {
  if (!emailId) return false

  await new Promise((resolve) => setTimeout(resolve, 1500))

  const { data, error } = await resend.emails.get(emailId)

  if (error || !data) {
    // Não deu pra confirmar o status (ex: instabilidade da própria API de
    // consulta) — cai de volta pro comportamento anterior (assume sucesso)
    // em vez de travar o cron por causa da checagem em si, mas fica
    // registrado no log pra investigar se acontecer com frequência.
    console.error(`[cron/prazos] Não foi possível confirmar status de entrega do e-mail ${emailId}:`, error)
    return true
  }

  if (EVENTOS_FALHA_ENTREGA.has(data.last_event)) {
    console.error(`[cron/prazos] E-mail ${emailId} foi aceito mas falhou no despacho (last_event=${data.last_event})`)
    return false
  }

  return true
}

type Prazo = {
  id: string
  status: string
  data_vencimento: string | null
  notificado_10_em: string | null
  clientes: { nome_empresa: string; email: string | null } | null
  obrigacoes_acessorias: { nome: string } | null
}

type Tarefa = {
  id: string
  titulo: string
  data_limite: string | null
  notificado_em: string | null
  clientes: { nome_empresa: string; email: string | null } | null
}

type ItemResumo = {
  nomeCliente: string
  nomeObrigacao: string
}

type ItemTarefaResumo = {
  nomeCliente: string
  titulo: string
  dataLimite: string
  diasRestantes: number
}

function diasEntre(dataVencimento: string, hoje: string) {
  const [anoV, mesV, diaV] = dataVencimento.split('-').map(Number)
  const [anoH, mesH, diaH] = hoje.split('-').map(Number)

  const dataVencimentoUTC = Date.UTC(anoV, mesV - 1, diaV)
  const hojeUTC = Date.UTC(anoH, mesH - 1, diaH)

  return Math.round((dataVencimentoUTC - hojeUTC) / (1000 * 60 * 60 * 24))
}

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization')

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)

  const hoje = new Date().toISOString().slice(0, 10)

  const { data: prazos, error } = await supabase
    .from('prazos')
    .select('id, status, data_vencimento, notificado_10_em, clientes(nome_empresa, email), obrigacoes_acessorias(nome)')
    .in('status', ['pendente', 'atencao'])
    .returns<Prazo[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let viraramAtencao = 0
  let viraramVencido = 0
  let emailsEnviados = 0
  let alertas10DiasEnviados = 0
  let puladosPorFaltaDeEmail = 0

  const novosEmAtencao: ItemResumo[] = []
  const vencidosHoje: ItemResumo[] = []
  const lembretes10Dias: ItemResumo[] = []

  for (const prazo of prazos ?? []) {
    if (!prazo.data_vencimento) continue

    const nomeCliente = prazo.clientes?.nome_empresa ?? 'Cliente'
    const nomeObrigacao = prazo.obrigacoes_acessorias?.nome ?? 'Obrigação'
    const diasRestantes = diasEntre(prazo.data_vencimento, hoje)

    if (diasRestantes < 0) {
      await supabase.from('prazos').update({ status: 'vencido' }).eq('id', prazo.id)
      viraramVencido += 1
      vencidosHoje.push({ nomeCliente, nomeObrigacao })
      continue
    }

    // Alerta antecipado (10 dias) — janela mais cedo que a de 5 dias, não
    // muda o status do prazo (só o alerta de 5 dias vira 'atencao'), só
    // manda o e-mail e marca notificado_10_em pra não repetir no próximo run.
    if (diasRestantes <= 10 && diasRestantes > 5 && !prazo.notificado_10_em) {
      const email = prazo.clientes?.email

      if (!email) {
        puladosPorFaltaDeEmail += 1
      } else {
        const { subject, html } = emailAlertaPrazoAntecipado({
          nomeCliente,
          nomeObrigacao,
          dataVencimento: prazo.data_vencimento,
          diasRestantes,
        })

        const { data: emailData, error: emailError } = await resend.emails.send({
          from: 'naoresponda@opcaocontabilbsb.com.br',
          to: email,
          cc: process.env.ADMIN_ALERT_EMAIL,
          subject,
          html,
        })

        if (!emailError && (await envioRealmenteTeveSucesso(resend, emailData?.id))) {
          await supabase
            .from('prazos')
            .update({ notificado_10_em: new Date().toISOString() })
            .eq('id', prazo.id)

          alertas10DiasEnviados += 1
          lembretes10Dias.push({ nomeCliente, nomeObrigacao })
        }
      }
    }

    if (diasRestantes <= 5 && prazo.status === 'pendente') {
      const email = prazo.clientes?.email

      if (!email) {
        puladosPorFaltaDeEmail += 1
        continue
      }

      const { subject, html } = emailAlertaPrazo({
        nomeCliente,
        nomeObrigacao,
        dataVencimento: prazo.data_vencimento,
        diasRestantes,
      })

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'naoresponda@opcaocontabilbsb.com.br',
        to: email,
        cc: process.env.ADMIN_ALERT_EMAIL,
        subject,
        html,
      })

      if (emailError) continue
      if (!(await envioRealmenteTeveSucesso(resend, emailData?.id))) continue

      await supabase
        .from('prazos')
        .update({ status: 'atencao', notificado_em: new Date().toISOString() })
        .eq('id', prazo.id)

      viraramAtencao += 1
      emailsEnviados += 1
      novosEmAtencao.push({ nomeCliente, nomeObrigacao })
    }
  }

  // Tarefas com prazo próximo (janela menor que a de prazos, por serem operacionais)
  const { data: tarefas } = await supabase
    .from('tarefas')
    .select('id, titulo, data_limite, notificado_em, clientes(nome_empresa, email)')
    .in('status', ['a_fazer', 'em_andamento'])
    .not('data_limite', 'is', null)
    .returns<Tarefa[]>()

  let tarefasNotificadas = 0
  const tarefasProximas: ItemTarefaResumo[] = []

  for (const tarefa of tarefas ?? []) {
    if (!tarefa.data_limite || tarefa.notificado_em) continue

    const diasRestantes = diasEntre(tarefa.data_limite, hoje)

    if (diasRestantes <= 2) {
      const nomeCliente = tarefa.clientes?.nome_empresa ?? 'Cliente'

      const { subject, html } = emailAlertaTarefa({
        titulo: tarefa.titulo,
        nomeCliente,
        dataLimite: tarefa.data_limite,
        diasRestantes,
      })

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'naoresponda@opcaocontabilbsb.com.br',
        to: process.env.ADMIN_ALERT_EMAIL!,
        subject,
        html,
      })

      if (emailError) continue
      if (!(await envioRealmenteTeveSucesso(resend, emailData?.id))) continue

      await supabase
        .from('tarefas')
        .update({ notificado_em: new Date().toISOString() })
        .eq('id', tarefa.id)

      tarefasNotificadas += 1
      tarefasProximas.push({ nomeCliente, titulo: tarefa.titulo, dataLimite: tarefa.data_limite, diasRestantes })
    }
  }

  const { subject: resumoSubject, html: resumoHtml } = emailResumoDiarioAdmin({
    novosEmAtencao,
    vencidosHoje,
    lembretes10Dias,
    tarefasProximas,
  })

  const { error: resumoError } = await resend.emails.send({
    from: 'naoresponda@opcaocontabilbsb.com.br',
    to: process.env.ADMIN_ALERT_EMAIL!,
    subject: resumoSubject,
    html: resumoHtml,
  })

  return NextResponse.json({
    viraramAtencao,
    viraramVencido,
    emailsEnviados,
    alertas10DiasEnviados,
    puladosPorFaltaDeEmail,
    tarefasNotificadas,
    resumoEnviado: !resumoError,
  })
}

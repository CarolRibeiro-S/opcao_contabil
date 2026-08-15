import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailAlertaPrazo, emailAlertaPrazoAntecipado, emailAlertaTarefa, emailResumoDiarioAdmin } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

// O Next.js exige que "maxDuration" seja um literal (a análise estática
// dele rejeita até uma referência de const — testado: quebra o build com
// "Invalid segment configuration export"). Por isso não dá pra compartilhar
// o mesmo valor via variável com o cálculo da trava de tempo logo abaixo —
// os dois precisam ser mantidos em sincronia manualmente. SE MUDAR UM,
// MUDE O OUTRO.
export const maxDuration = 60
const MAX_DURATION_SEGUNDOS = 60

// Quantos e-mails processamos ao mesmo tempo, em vez de um de cada vez. Com
// a verificação de entrega (~1.5s/item, ver envioRealmenteTeveSucesso) e
// processamento sequencial, ~84 alertas num dia (volume real de 15/08) já
// passavam de 150s — bem acima do maxDuration. Em lotes concorrentes, o
// tempo total vira ~(N / TAMANHO_LOTE_ENVIO) * tempo por item, não N vezes.
const TAMANHO_LOTE_ENVIO = 10

// Rede de segurança contra crescimento futuro de volume: mesmo em lotes,
// se a base de clientes crescer muito o tempo total pode voltar a se
// aproximar do limite. Ao passar de 80% do maxDuration, o cron para de
// começar lotes NOVOS e encerra graciosamente — o resto da lista fica pro
// próximo disparo, que já pula quem tem status != 'pendente' (etapa 1,
// idempotente por natureza) ou notificado_em/notificado_10_em preenchido
// (etapa 2), então não há risco de duplicar nada.
const FRACAO_LIMITE_TEMPO = 0.8
const LIMITE_TEMPO_MS = MAX_DURATION_SEGUNDOS * 1000 * FRACAO_LIMITE_TEMPO

function tempoEsgotado(inicioExecucao: number): boolean {
  return Date.now() - inicioExecucao > LIMITE_TEMPO_MS
}

// A resposta síncrona de resend.emails.send() só confirma que a Resend
// ACEITOU o e-mail na fila — o tipo de retorno de sucesso só tem um campo,
// { id }. Não existe status de entrega nessa resposta. Falhas que só
// acontecem no despacho em si (ex: cota diária excedida) nunca aparecem no
// "error" do send() — só depois, consultando o e-mail pelo id (campo
// last_event). É exatamente esse buraco que causou o bug do dia 15/08: um
// envio que a Resend aceitou mas não conseguiu despachar (cota) foi tratado
// como sucesso porque só checávamos o "error" do send().
//
// Por isso, além do erro síncrono (checado antes desta função ser
// chamada), esperamos um instante e conferimos o last_event via GET
// /emails/{id} antes de gravar qualquer coisa no banco. 'failed',
// 'bounced', 'canceled', 'complained' e 'suppressed' são os estados que a
// própria Resend documenta como terminais de falha — qualquer um desses
// bloqueia a gravação. Os demais (queued/scheduled/sent/delivered/
// opened/clicked/delivery_delayed) são tratados como "o envio está de pé".
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

type ResultadoLotes = { processados: number; interrompidoPorTempo: boolean }

// Roda `tarefa` em paralelo pra cada item da lista, em lotes de
// `tamanhoLote` por vez (não tudo de uma vez — evita rajadas grandes demais
// contra a API da Resend). Cada lote espera terminar antes do próximo
// começar; dentro de um lote, os itens rodam concorrentemente.
//
// Antes de CADA lote novo (nunca no meio de um lote já em andamento — os
// itens que já começaram sempre terminam), confere se já passou de
// FRACAO_LIMITE_TEMPO do tempo total disponível. Se sim, para ali: os
// itens restantes ficam pro próximo disparo do cron.
async function emLotes<T>(
  itens: T[],
  tamanhoLote: number,
  inicioExecucao: number,
  tarefa: (item: T) => Promise<void>
): Promise<ResultadoLotes> {
  for (let i = 0; i < itens.length; i += tamanhoLote) {
    if (tempoEsgotado(inicioExecucao)) {
      const restantes = itens.length - i
      console.error(
        `[cron/prazos] Tempo esgotado (>${FRACAO_LIMITE_TEMPO * 100}% de ${MAX_DURATION_SEGUNDOS}s) — parando com ${restantes} item(ns) pendente(s) pro próximo disparo.`
      )
      return { processados: i, interrompidoPorTempo: true }
    }

    const lote = itens.slice(i, i + tamanhoLote)
    await Promise.all(lote.map((item) => tarefa(item)))
  }

  return { processados: itens.length, interrompidoPorTempo: false }
}

type Prazo = {
  id: string
  status: string
  data_vencimento: string | null
  notificado_em: string | null
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

  // Relógio da trava de tempo (Problema 3) — conta a partir daqui, não do
  // início da requisição HTTP em si (a diferença é desprezível), pra todo
  // emLotes() usar o mesmo referencial.
  const inicioExecucao = Date.now()

  const supabase = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)

  const hoje = new Date().toISOString().slice(0, 10)

  const { data: prazos, error } = await supabase
    .from('prazos')
    .select(
      'id, status, data_vencimento, notificado_em, notificado_10_em, clientes(nome_empresa, email), obrigacoes_acessorias(nome)'
    )
    .in('status', ['pendente', 'atencao'])
    .returns<Prazo[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ETAPA 1 — Kanban, só por data. "Está perto de vencer" é uma pergunta
  // sobre data_vencimento, não sobre e-mail ter sido entregue — por isso
  // essa etapa roda inteira ANTES de qualquer chamada à Resend, com updates
  // em lote (não um de cada vez), e nunca fica esperando confirmação de
  // envio de ninguém. Antes, essa transição só acontecia depois do e-mail
  // confirmado, o que travava prazos em "pendente" indefinidamente sempre
  // que um envio falhava ou o cron era cortado no meio (caso real de
  // 15/08) — e também travava PERMANENTEMENTE qualquer cliente sem e-mail
  // cadastrado, já que o "continue" por falta de e-mail rodava antes de
  // qualquer chance de atualizar o status.
  const idsParaVencido: string[] = []
  const idsParaAtencao: string[] = []
  const vencidosHoje: ItemResumo[] = []
  const novosEmAtencao: ItemResumo[] = []

  for (const prazo of prazos ?? []) {
    if (!prazo.data_vencimento) continue

    const nomeCliente = prazo.clientes?.nome_empresa ?? 'Cliente'
    const nomeObrigacao = prazo.obrigacoes_acessorias?.nome ?? 'Obrigação'
    const diasRestantes = diasEntre(prazo.data_vencimento, hoje)

    if (diasRestantes < 0) {
      idsParaVencido.push(prazo.id)
      vencidosHoje.push({ nomeCliente, nomeObrigacao })
    } else if (diasRestantes <= 5 && prazo.status === 'pendente') {
      idsParaAtencao.push(prazo.id)
      novosEmAtencao.push({ nomeCliente, nomeObrigacao })
    }
  }

  if (idsParaVencido.length > 0) {
    await supabase.from('prazos').update({ status: 'vencido' }).in('id', idsParaVencido)
  }

  if (idsParaAtencao.length > 0) {
    await supabase.from('prazos').update({ status: 'atencao' }).in('id', idsParaAtencao)
  }

  const viraramVencido = idsParaVencido.length
  const viraramAtencao = idsParaAtencao.length

  // ETAPA 2 — alertas por e-mail, separados da atualização de Kanban acima
  // e processados em lotes concorrentes (ver emLotes/TAMANHO_LOTE_ENVIO).
  // Prazos que acabaram de vencer (idsParaVencido) ficam de fora — não faz
  // sentido mandar "vence em X dias" pra quem já venceu.
  const idsVencidosSet = new Set(idsParaVencido)

  let alertas10DiasEnviados = 0
  let emailsEnviados = 0
  let puladosPorFaltaDeEmail = 0
  const lembretes10Dias: ItemResumo[] = []

  const candidatosAlertaAntecipado = (prazos ?? []).filter((prazo) => {
    if (!prazo.data_vencimento || idsVencidosSet.has(prazo.id)) return false
    const diasRestantes = diasEntre(prazo.data_vencimento, hoje)
    return diasRestantes <= 10 && diasRestantes > 5 && !prazo.notificado_10_em
  })

  const resultadoAntecipado = await emLotes(candidatosAlertaAntecipado, TAMANHO_LOTE_ENVIO, inicioExecucao, async (prazo) => {
    const email = prazo.clientes?.email

    if (!email) {
      puladosPorFaltaDeEmail += 1
      return
    }

    const nomeCliente = prazo.clientes?.nome_empresa ?? 'Cliente'
    const nomeObrigacao = prazo.obrigacoes_acessorias?.nome ?? 'Obrigação'
    const diasRestantes = diasEntre(prazo.data_vencimento!, hoje)

    const { subject, html } = emailAlertaPrazoAntecipado({
      nomeCliente,
      nomeObrigacao,
      dataVencimento: prazo.data_vencimento!,
      diasRestantes,
    })

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'naoresponda@opcaocontabilbsb.com.br',
      to: email,
      cc: process.env.ADMIN_ALERT_EMAIL,
      subject,
      html,
    })

    if (emailError || !(await envioRealmenteTeveSucesso(resend, emailData?.id))) return

    await supabase.from('prazos').update({ notificado_10_em: new Date().toISOString() }).eq('id', prazo.id)

    alertas10DiasEnviados += 1
    lembretes10Dias.push({ nomeCliente, nomeObrigacao })
  })

  // Gatilho pra esse alerta agora é notificado_em (não mais status==='pendente'
  // combinado ao envio) — reflete "ainda não confirmamos envio pra esse
  // prazo", independente de ele já ter virado 'atencao' na etapa 1.
  const candidatosAlertaPrincipal = (prazos ?? []).filter((prazo) => {
    if (!prazo.data_vencimento || idsVencidosSet.has(prazo.id)) return false
    const diasRestantes = diasEntre(prazo.data_vencimento, hoje)
    return diasRestantes <= 5 && !prazo.notificado_em
  })

  const resultadoPrincipal = await emLotes(candidatosAlertaPrincipal, TAMANHO_LOTE_ENVIO, inicioExecucao, async (prazo) => {
    const email = prazo.clientes?.email

    if (!email) {
      puladosPorFaltaDeEmail += 1
      return
    }

    const nomeCliente = prazo.clientes?.nome_empresa ?? 'Cliente'
    const nomeObrigacao = prazo.obrigacoes_acessorias?.nome ?? 'Obrigação'
    const diasRestantes = diasEntre(prazo.data_vencimento!, hoje)

    const { subject, html } = emailAlertaPrazo({
      nomeCliente,
      nomeObrigacao,
      dataVencimento: prazo.data_vencimento!,
      diasRestantes,
    })

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'naoresponda@opcaocontabilbsb.com.br',
      to: email,
      cc: process.env.ADMIN_ALERT_EMAIL,
      subject,
      html,
    })

    if (emailError || !(await envioRealmenteTeveSucesso(resend, emailData?.id))) return

    await supabase.from('prazos').update({ notificado_em: new Date().toISOString() }).eq('id', prazo.id)

    emailsEnviados += 1
  })

  // Tarefas com prazo próximo (janela menor que a de prazos, por serem
  // operacionais) — já eram independentes do status de prazos; agora
  // também rodam em lotes concorrentes pelo mesmo motivo de tempo total.
  const { data: tarefas } = await supabase
    .from('tarefas')
    .select('id, titulo, data_limite, notificado_em, clientes(nome_empresa, email)')
    .in('status', ['a_fazer', 'em_andamento'])
    .not('data_limite', 'is', null)
    .returns<Tarefa[]>()

  let tarefasNotificadas = 0
  const tarefasProximas: ItemTarefaResumo[] = []

  const tarefasCandidatas = (tarefas ?? []).filter((tarefa) => {
    if (!tarefa.data_limite || tarefa.notificado_em) return false
    return diasEntre(tarefa.data_limite, hoje) <= 2
  })

  const resultadoTarefas = await emLotes(tarefasCandidatas, TAMANHO_LOTE_ENVIO, inicioExecucao, async (tarefa) => {
    const nomeCliente = tarefa.clientes?.nome_empresa ?? 'Cliente'
    const diasRestantes = diasEntre(tarefa.data_limite!, hoje)

    const { subject, html } = emailAlertaTarefa({
      titulo: tarefa.titulo,
      nomeCliente,
      dataLimite: tarefa.data_limite!,
      diasRestantes,
    })

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'naoresponda@opcaocontabilbsb.com.br',
      to: process.env.ADMIN_ALERT_EMAIL!,
      subject,
      html,
    })

    if (emailError || !(await envioRealmenteTeveSucesso(resend, emailData?.id))) return

    await supabase.from('tarefas').update({ notificado_em: new Date().toISOString() }).eq('id', tarefa.id)

    tarefasNotificadas += 1
    tarefasProximas.push({ nomeCliente, titulo: tarefa.titulo, dataLimite: tarefa.data_limite!, diasRestantes })
  })

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

  const interrompidoPorTempo =
    resultadoAntecipado.interrompidoPorTempo || resultadoPrincipal.interrompidoPorTempo || resultadoTarefas.interrompidoPorTempo

  return NextResponse.json({
    viraramAtencao,
    viraramVencido,
    emailsEnviados,
    alertas10DiasEnviados,
    puladosPorFaltaDeEmail,
    tarefasNotificadas,
    resumoEnviado: !resumoError,
    // true quando alguma etapa de envio parou antes de terminar a lista
    // por causa da trava de tempo (Problema 3) — o restante fica pro
    // próximo disparo do cron, sem risco de duplicar (etapa 1, o Kanban,
    // sempre roda inteira; só os e-mails ficam pra depois).
    interrompidoPorTempo,
    duracaoMs: Date.now() - inicioExecucao,
  })
}

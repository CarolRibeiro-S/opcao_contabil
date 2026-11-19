import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailResumoReconciliacaoEntregas, type ItemFalhaTardiaReconciliacao } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

// Mesmo valor/comentário de sincronia manual já usado nos outros crons
// (cron/prazos, envio-mensal) — o Next.js exige literal aqui, não aceita
// referenciar MAX_DURATION_SEGUNDOS. SE MUDAR UM, MUDE O OUTRO.
export const maxDuration = 60
const MAX_DURATION_SEGUNDOS = 60

const TAMANHO_LOTE_ENVIO = 10
const FRACAO_LIMITE_TEMPO = 0.8
const LIMITE_TEMPO_MS = MAX_DURATION_SEGUNDOS * 1000 * FRACAO_LIMITE_TEMPO

// Janela de verificação — cobre qualquer falha tardia confirmada pela
// Resend depois do envio, incluindo casos em que o próprio webhook (que já
// deveria ter capturado isso em tempo real) estava fora do ar por algum
// motivo. 7 dias dá margem confortável sem reprocessar o histórico todo.
const DIAS_JANELA = 7

function tempoEsgotado(inicioExecucao: number): boolean {
  return Date.now() - inicioExecucao > LIMITE_TEMPO_MS
}

type ResultadoLotes = { processados: number; interrompidoPorTempo: boolean }

async function emLotes<T>(
  itens: T[],
  tamanhoLote: number,
  inicioExecucao: number,
  tarefa: (item: T) => Promise<void>
): Promise<ResultadoLotes> {
  for (let i = 0; i < itens.length; i += tamanhoLote) {
    if (tempoEsgotado(inicioExecucao)) {
      console.error(
        `[cron/reconciliar-entregas] Tempo esgotado (>${FRACAO_LIMITE_TEMPO * 100}% de ${MAX_DURATION_SEGUNDOS}s) — ${itens.length - i} item(ns) ficam pro próximo disparo (ainda dentro da janela de ${DIAS_JANELA} dias).`
      )
      return { processados: i, interrompidoPorTempo: true }
    }

    const lote = itens.slice(i, i + tamanhoLote)
    await Promise.all(lote.map((item) => tarefa(item)))
  }

  return { processados: itens.length, interrompidoPorTempo: false }
}

// Mesmos 5 estados terminais de falha já usados em envioRealmenteTeveSucesso
// (ver cron/prazos, envio-mensal, cobrancas/notificar-boleto,
// cron/solicitacao-mensal) — aqui não tem espera de 1,5s porque não é logo
// depois do envio, é um dia (ou mais) depois: se a Resend ainda não
// convergiu pra um estado terminal a essa altura, não é um problema que
// essa checagem deveria resolver.
const EVENTOS_FALHA_ENTREGA = new Set(['failed', 'bounced', 'canceled', 'complained', 'suppressed'])

type ClienteRef = { nome_empresa: string } | null

type DocumentoRow = {
  id: string
  nome_arquivo: string
  resend_email_id: string
  clientes: ClienteRef
}

type CobrancaRow = {
  id: string
  competencia: string | null
  resend_email_id: string
  clientes: ClienteRef
}

type EnvioSolicitacaoRow = {
  id: string
  competencia: string
  tipo: string
  resend_email_id: string
  clientes: ClienteRef
}

// Item unificado das 3 origens — cobrancas fica de fora da descrição por
// tabela porque usa um shape ligeiramente diferente (nome_arquivo não
// existe lá, por exemplo); normalizado aqui pra todo o resto do fluxo
// (checagem, inserção em email_eventos, e-mail de resumo) tratar igual.
type ItemReconciliacao = {
  origem: ItemFalhaTardiaReconciliacao['origem']
  clienteNome: string
  descricao: string
  resendEmailId: string
}

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization')

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const inicioExecucao = Date.now()
  const supabaseAdmin = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)

  const desde = new Date(Date.now() - DIAS_JANELA * 24 * 60 * 60 * 1000).toISOString()

  const [documentosRes, cobrancasRes, solicitacoesRes] = await Promise.all([
    supabaseAdmin
      .from('documentos_clientes')
      .select('id, nome_arquivo, resend_email_id, clientes(nome_empresa)')
      .not('resend_email_id', 'is', null)
      .gte('enviado_em', desde)
      .returns<DocumentoRow[]>(),
    supabaseAdmin
      .from('cobrancas')
      .select('id, competencia, resend_email_id, clientes(nome_empresa)')
      .not('resend_email_id', 'is', null)
      .gte('enviado_email_em', desde)
      .returns<CobrancaRow[]>(),
    supabaseAdmin
      .from('envios_solicitacao_mensal')
      .select('id, competencia, tipo, resend_email_id, clientes(nome_empresa)')
      .not('resend_email_id', 'is', null)
      .gte('enviado_em', desde)
      .returns<EnvioSolicitacaoRow[]>(),
  ])

  const itens: ItemReconciliacao[] = [
    ...(documentosRes.data ?? []).map((documento) => ({
      origem: 'Documento' as const,
      clienteNome: documento.clientes?.nome_empresa ?? 'Cliente',
      descricao: documento.nome_arquivo,
      resendEmailId: documento.resend_email_id,
    })),
    ...(cobrancasRes.data ?? []).map((cobranca) => ({
      origem: 'Honorário' as const,
      clienteNome: cobranca.clientes?.nome_empresa ?? 'Cliente',
      descricao: cobranca.competencia ? `honorário ${cobranca.competencia}` : 'honorário',
      resendEmailId: cobranca.resend_email_id,
    })),
    ...(solicitacoesRes.data ?? []).map((envio) => ({
      origem: 'Solicitação Mensal' as const,
      clienteNome: envio.clientes?.nome_empresa ?? 'Cliente',
      descricao: `${envio.tipo} — ${envio.competencia}`,
      resendEmailId: envio.resend_email_id,
    })),
  ]

  // Cruza com email_eventos primeiro — qualquer resend_email_id que já
  // tenha um evento de falha registrado (seja pelo webhook em tempo real,
  // seja por uma reconciliação de um dia anterior) já está sinalizado em
  // email_eventos, então pular ele aqui economiza uma chamada à API da
  // Resend por item e evita inserir um evento duplicado.
  const todosOsIds = [...new Set(itens.map((item) => item.resendEmailId))]

  const idsJaRegistrados = new Set<string>()
  if (todosOsIds.length > 0) {
    const { data: eventosExistentes } = await supabaseAdmin
      .from('email_eventos')
      .select('resend_email_id')
      .in('resend_email_id', todosOsIds)

    for (const evento of eventosExistentes ?? []) idsJaRegistrados.add(evento.resend_email_id)
  }

  const itensParaChecar = itens.filter((item) => !idsJaRegistrados.has(item.resendEmailId))

  const falhasEncontradas: ItemFalhaTardiaReconciliacao[] = []

  const resultado = await emLotes(itensParaChecar, TAMANHO_LOTE_ENVIO, inicioExecucao, async (item) => {
    const { data, error } = await resend.emails.get(item.resendEmailId)

    if (error || !data) {
      console.error(`[cron/reconciliar-entregas] Não foi possível consultar ${item.resendEmailId}:`, error)
      return
    }

    if (!EVENTOS_FALHA_ENTREGA.has(data.last_event)) return

    // Grava no MESMO formato que o webhook já grava (ver
    // api/webhooks/resend/route.ts) — é o que faz a UI que já existe
    // (badge "Não entregue" em CobrancasTable, cruzando por
    // resend_email_id) funcionar sem nenhuma mudança de schema ou de
    // tela. O prefixo no detalhe só distingue, pra quem olhar o dado
    // direto, que essa falha veio da reconciliação, não do webhook em
    // tempo real — a Resend não devolve o motivo detalhado (bounce.type/
    // message) por este endpoint, só o last_event.
    const { error: insertError } = await supabaseAdmin.from('email_eventos').insert({
      resend_email_id: item.resendEmailId,
      tipo: data.last_event,
      detalhe: `[Detectado por reconciliação] Confirmado ${data.last_event} pela Resend após o envio ter sido marcado como bem-sucedido.`,
    })

    if (insertError) {
      console.error(`[cron/reconciliar-entregas] Falha ao gravar email_eventos pra ${item.resendEmailId}:`, insertError)
      return
    }

    falhasEncontradas.push({
      origem: item.origem,
      clienteNome: item.clienteNome,
      descricao: item.descricao,
      tipoFalha: data.last_event,
    })
  })

  if (falhasEncontradas.length > 0) {
    const { subject, html } = emailResumoReconciliacaoEntregas({ itens: falhasEncontradas })

    const { error: emailError } = await resend.emails.send({
      from: 'naoresponda@opcaocontabilbsb.com.br',
      to: process.env.ADMIN_ALERT_EMAIL!,
      subject,
      html,
    })

    if (emailError) {
      console.error('[cron/reconciliar-entregas] Falha ao enviar resumo de falhas tardias:', emailError)
    }
  }

  return NextResponse.json({
    verificados: itens.length,
    jaRegistradosAntes: idsJaRegistrados.size,
    checadosNestaExecucao: resultado.processados,
    falhasTardiasEncontradas: falhasEncontradas.length,
    interrompidoPorTempo: resultado.interrompidoPorTempo,
  })
}

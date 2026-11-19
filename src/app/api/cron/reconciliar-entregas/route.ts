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

// 8, não 10 — a API da Resend limita a 10 requisições/segundo no total
// (ver consultarComRetry); folga de 2 pra qualquer outra chamada
// concorrente (ex: outro admin usando o sistema ao mesmo tempo).
const TAMANHO_LOTE_ENVIO = 8
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

// Achado real ao testar esta rota: 10 chamadas concorrentes de
// resend.emails.get() (um lote inteiro de TAMANHO_LOTE_ENVIO) já é
// suficiente pra bater no limite de 10 requisições/segundo da própria API
// da Resend — a maioria dos itens de um lote cheio volta com
// rate_limit_exceeded (429), e sem isso eles cairiam no fallback de "não
// deu pra confirmar, assume sucesso" (ver early return abaixo), deixando
// de detectar falhas reais só por causa do limite de taxa, não por falta
// de falha de verdade. Com retry e backoff, a segunda tentativa já cai
// fora da mesma janela de 1s e passa.
async function consultarComRetry(resend: Resend, emailId: string, tentativas = 3) {
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const resultado = await resend.emails.get(emailId)
    const ehRateLimit = resultado.error?.name === 'rate_limit_exceeded' || (resultado.error as { statusCode?: number } | null)?.statusCode === 429

    if (!ehRateLimit || tentativa === tentativas) return resultado

    await new Promise((resolve) => setTimeout(resolve, 1200 * tentativa))
  }

  // Inalcançável (o loop sempre retorna no último "tentativa === tentativas"),
  // só aqui pra satisfazer o TypeScript sobre o tipo de retorno da função.
  return resend.emails.get(emailId)
}

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

type ClienteConviteRow = {
  id: string
  nome_empresa: string
  convite_resend_email_id: string
}

// Convite de membro de equipe fica em profiles (não em clientes) — mesma
// coluna de rastreio, tabela diferente, porque o profile já é a entidade
// (1:1 com a pessoa), sem a complicação de profile_id compartilhado que
// existe pra clientes. Ver api/equipe/convidar/route.ts.
type ProfileConviteRow = {
  id: string
  nome: string | null
  convite_resend_email_id: string
}

// Item unificado das origens — cobrancas fica de fora da descrição por
// tabela porque usa um shape ligeiramente diferente (nome_arquivo não
// existe lá, por exemplo); normalizado aqui pra todo o resto do fluxo
// (checagem, inserção em email_eventos, e-mail de resumo) tratar igual.
// marcarConviteFalhaEm só é preenchido pras origens de convite ('Convite'
// e 'Convite (Equipe)') — é o que permite atualizar
// clientes.convite_falha_confirmada_em ou profiles.convite_falha_confirmada_em
// além de email_eventos (ver comentário no cruzamento mais abaixo).
type ItemReconciliacao = {
  origem: ItemFalhaTardiaReconciliacao['origem']
  clienteNome: string
  descricao: string
  resendEmailId: string
  marcarConviteFalhaEm?: { tabela: 'clientes' | 'profiles'; id: string }
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

  const [documentosRes, cobrancasRes, solicitacoesRes, convitesRes, convitesEquipeRes] = await Promise.all([
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
    // Diferente das outras 3 origens, aqui a checagem síncrona já grava
    // a falha direto em convite_falha_confirmada_em (ver api/clientes/
    // convidar e api/clientes/atualizar-email-acesso) — por isso o filtro
    // abaixo já exclui quem a própria rota já confirmou como falha, só
    // sobrando quem ainda está "sem confirmação" pra essa checagem tardia
    // cobrir (ex: bounce que só confirmou depois do 1,5s de espera).
    supabaseAdmin
      .from('clientes')
      .select('id, nome_empresa, convite_resend_email_id')
      .not('convite_resend_email_id', 'is', null)
      .is('convite_falha_confirmada_em', null)
      .gte('convite_enviado_em', desde)
      .returns<ClienteConviteRow[]>(),
    supabaseAdmin
      .from('profiles')
      .select('id, nome, convite_resend_email_id')
      .not('convite_resend_email_id', 'is', null)
      .is('convite_falha_confirmada_em', null)
      .gte('convite_enviado_em', desde)
      .returns<ProfileConviteRow[]>(),
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
    ...(convitesRes.data ?? []).map((cliente) => ({
      origem: 'Convite' as const,
      clienteNome: cliente.nome_empresa,
      descricao: 'código de acesso ao Portal',
      resendEmailId: cliente.convite_resend_email_id,
      marcarConviteFalhaEm: { tabela: 'clientes' as const, id: cliente.id },
    })),
    ...(convitesEquipeRes.data ?? []).map((membro) => ({
      origem: 'Convite (Equipe)' as const,
      clienteNome: membro.nome ?? 'Membro da equipe',
      descricao: 'código de acesso ao Admin',
      resendEmailId: membro.convite_resend_email_id,
      marcarConviteFalhaEm: { tabela: 'profiles' as const, id: membro.id },
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
    const { data, error } = await consultarComRetry(resend, item.resendEmailId)

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

    // Convite é o único caso em que o admin não vê o badge através de
    // email_eventos (ClientesTable.tsx lê clientes.convite_falha_confirmada_em
    // direto, sem cruzar — ver desenho combinado antes dessa Frente 3; o
    // mesmo vale pra profiles, se/quando a tela de Equipe ganhar um badge
    // equivalente). Sem essa segunda escrita, a falha tardia nunca
    // apareceria nessas telas, só as que a checagem síncrona já pegou.
    if (item.marcarConviteFalhaEm) {
      const { tabela, id } = item.marcarConviteFalhaEm
      const { error: updateConviteError } = await supabaseAdmin
        .from(tabela)
        .update({ convite_falha_confirmada_em: new Date().toISOString() })
        .eq('id', id)

      if (updateConviteError) {
        console.error(`[cron/reconciliar-entregas] Falha ao marcar convite_falha_confirmada_em em ${tabela} (${id}):`, updateConviteError)
      }
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

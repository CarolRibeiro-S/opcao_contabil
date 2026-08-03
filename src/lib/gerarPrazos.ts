import { createAdminClient } from '@/lib/supabase/admin'
import { diaUtilDoMes, proximoDiaUtil, ultimoDiaUtilDoMes } from '@/lib/feriados'

type ClienteRow = {
  id: string
  nome_empresa: string
  tipo: string
  regime_tributario: string | null
  possui_empregados: boolean | null
  obrigado_efd_contribuicoes: boolean | null
}

type RegraObrigacao = {
  id: string
  regime: string
  condicional: string | null
  periodicidade: string
  tipo_vencimento: string
  dia_fixo: number | null
  meses_offset: number | null
  mes_fixo: number | null
  obrigacao_id: string
  n_dia_util: number | null
}

type ItemGerado = { clienteId: string; nomeCliente: string; obrigacaoId: string; competencia: string }

function formatarDataISO(data: Date) {
  return data.toISOString().slice(0, 10)
}

function regimeEfetivo(cliente: ClienteRow): string | null {
  if (cliente.tipo === 'mei') return 'mei'
  return cliente.regime_tributario
}

function clientePassaCondicional(cliente: ClienteRow, condicional: string | null) {
  if (condicional === 'empregados') return !!cliente.possui_empregados
  if (condicional === 'obrigado_efd_contribuicoes') return !!cliente.obrigado_efd_contribuicoes
  return true
}

// Desloca (ano, mes) em N meses, já normalizando virada de ano.
function deslocarMes(ano: number, mes: number, deslocamento: number) {
  const totalMeses = ano * 12 + (mes - 1) + deslocamento
  return { ano: Math.floor(totalMeses / 12), mes: (totalMeses % 12) + 1 }
}

// Regras mensais: meses_offset conta a partir do mês de COMPETÊNCIA (não do
// mês em que o cron roda). Default 1 — vencimento no mês seguinte ao da
// competência, que é o padrão real das obrigações fiscais brasileiras (ex:
// DAS do Simples de uma competência vence no mês seguinte).
function calcularVencimentoMensal(regra: RegraObrigacao, competenciaAno: number, competenciaMes: number): Date | null {
  const deslocamento = regra.meses_offset ?? 1
  const { ano: vencAno, mes: vencMes } = deslocarMes(competenciaAno, competenciaMes, deslocamento)

  if (regra.tipo_vencimento === 'dia_fixo') {
    if (!regra.dia_fixo) return null
    return proximoDiaUtil(new Date(Date.UTC(vencAno, vencMes - 1, regra.dia_fixo)))
  }

  if (regra.tipo_vencimento === 'dia_util_mes_seguinte') {
    if (!regra.n_dia_util) return null
    return proximoDiaUtil(diaUtilDoMes(vencAno, vencMes, regra.n_dia_util))
  }

  return null
}

function calcularVencimentoAnual(regra: RegraObrigacao, ano: number): Date | null {
  if (!regra.mes_fixo) return null

  if (regra.tipo_vencimento === 'ultimo_dia_util') {
    return proximoDiaUtil(ultimoDiaUtilDoMes(ano, regra.mes_fixo))
  }

  if (regra.tipo_vencimento === 'dia_fixo') {
    if (!regra.dia_fixo) return null
    return proximoDiaUtil(new Date(Date.UTC(ano, regra.mes_fixo - 1, regra.dia_fixo)))
  }

  if (regra.tipo_vencimento === 'dia_util_mes_seguinte') {
    if (!regra.n_dia_util) return null
    return proximoDiaUtil(diaUtilDoMes(ano, regra.mes_fixo, regra.n_dia_util))
  }

  return null
}

export type ResumoGeracaoPrazos = {
  totalGerados: number
  totalPulados: number
  porCliente: { clienteId: string; nomeCliente: string; gerados: number }[]
}

// Núcleo da geração automática de prazos — chamado tanto pelo cron semanal
// (/api/cron/gerar-prazos, protegido por CRON_SECRET) quanto pelo botão
// manual do admin (/api/admin/gerar-prazos, protegido por sessão+role).
// Idempotente: rodar de novo no mesmo dia/mês não duplica nada, porque cada
// prazo é checado por cliente_id + obrigacao_id + competencia antes de
// inserir.
//
// competenciaAlvo (formato 'YYYY-MM') é opcional e serve só pra preencher
// retroativamente uma competência específica das obrigações MENSAIS (ex:
// um mês que ficou sem geração antes do sistema existir de verdade). Sem
// ele, mantém o comportamento normal: competência do mês seguinte ao atual.
// Obrigações anuais não são afetadas por esse parâmetro — continuam usando
// o ano corrente real, já que o pedido de geração retroativa foi
// especificamente sobre "meses que ficaram sem geração".
export async function gerarPrazosAutomaticos(competenciaAlvo?: string): Promise<ResumoGeracaoPrazos> {
  const supabase = createAdminClient()

  const agora = new Date()
  const anoAtual = agora.getUTCFullYear()
  const mesAtual = agora.getUTCMonth() + 1

  let competenciaMensalAno: number
  let competenciaMensalMes: number

  if (competenciaAlvo) {
    const [anoStr, mesStr] = competenciaAlvo.split('-')
    competenciaMensalAno = Number(anoStr)
    competenciaMensalMes = Number(mesStr)
  } else {
    // Gera com antecedência: a competência tratada nesta rodada é a do mês
    // seguinte ao atual, não a do mês corrente — dá tempo do prazo aparecer
    // pro cliente/admin bem antes do vencimento real (que, por sua vez, cai
    // no mês seguinte AO DA COMPETÊNCIA — ver calcularVencimentoMensal).
    const deslocado = deslocarMes(anoAtual, mesAtual, 1)
    competenciaMensalAno = deslocado.ano
    competenciaMensalMes = deslocado.mes
  }

  const competenciaMensal = `${competenciaMensalAno}-${String(competenciaMensalMes).padStart(2, '0')}-01`

  // Obrigações anuais não têm mês de competência — usamos 1º de janeiro do
  // ano corrente como convenção pra guardar em prazos.competencia (coluna
  // date) e conseguir checar duplicidade por ano.
  const competenciaAnual = `${anoAtual}-01-01`

  const { data: clientes, error: clientesError } = await supabase
    .from('clientes')
    .select('id, nome_empresa, tipo, regime_tributario, possui_empregados, obrigado_efd_contribuicoes')
    .eq('status', 'ativo')
    .or('regime_tributario.not.is.null,tipo.eq.mei')
    .returns<ClienteRow[]>()

  if (clientesError) {
    throw new Error(`Falha ao buscar clientes: ${clientesError.message}`)
  }

  const { data: regras, error: regrasError } = await supabase
    .from('regras_obrigacoes')
    .select('id, regime, condicional, periodicidade, tipo_vencimento, dia_fixo, meses_offset, mes_fixo, obrigacao_id, n_dia_util')
    .returns<RegraObrigacao[]>()

  if (regrasError) {
    throw new Error(`Falha ao buscar regras_obrigacoes: ${regrasError.message}`)
  }

  const regrasPorRegime = new Map<string, RegraObrigacao[]>()
  for (const regra of regras ?? []) {
    const lista = regrasPorRegime.get(regra.regime) ?? []
    lista.push(regra)
    regrasPorRegime.set(regra.regime, lista)
  }

  const gerados: ItemGerado[] = []
  let totalPulados = 0

  for (const cliente of clientes ?? []) {
    const regime = regimeEfetivo(cliente)
    if (!regime) continue

    const regrasDoRegime = regrasPorRegime.get(regime) ?? []

    for (const regra of regrasDoRegime) {
      if (!clientePassaCondicional(cliente, regra.condicional)) continue

      let dataVencimento: Date | null = null
      let competencia: string

      if (regra.periodicidade === 'mensal') {
        dataVencimento = calcularVencimentoMensal(regra, competenciaMensalAno, competenciaMensalMes)
        competencia = competenciaMensal
      } else if (regra.periodicidade === 'anual') {
        dataVencimento = calcularVencimentoAnual(regra, anoAtual)
        competencia = competenciaAnual
      } else {
        continue
      }

      if (!dataVencimento) continue

      const { data: existente } = await supabase
        .from('prazos')
        .select('id')
        .eq('cliente_id', cliente.id)
        .eq('obrigacao_id', regra.obrigacao_id)
        .eq('competencia', competencia)
        .maybeSingle()

      if (existente) {
        totalPulados += 1
        continue
      }

      const { error: insertError } = await supabase.from('prazos').insert({
        cliente_id: cliente.id,
        obrigacao_id: regra.obrigacao_id,
        competencia,
        data_vencimento: formatarDataISO(dataVencimento),
        status: 'pendente',
      })

      if (insertError) {
        console.error('[gerarPrazosAutomaticos] Erro ao inserir prazo:', insertError)
        continue
      }

      gerados.push({
        clienteId: cliente.id,
        nomeCliente: cliente.nome_empresa,
        obrigacaoId: regra.obrigacao_id,
        competencia,
      })
    }
  }

  const porClienteMap = new Map<string, { nomeCliente: string; gerados: number }>()
  for (const item of gerados) {
    const atual = porClienteMap.get(item.clienteId) ?? { nomeCliente: item.nomeCliente, gerados: 0 }
    atual.gerados += 1
    porClienteMap.set(item.clienteId, atual)
  }

  return {
    totalGerados: gerados.length,
    totalPulados,
    porCliente: Array.from(porClienteMap.entries()).map(([clienteId, info]) => ({
      clienteId,
      nomeCliente: info.nomeCliente,
      gerados: info.gerados,
    })),
  }
}

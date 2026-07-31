import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const cardClasses =
  'rounded-lg border border-rule bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md'

const atalhoClasses =
  'text-xs font-semibold text-navy-soft underline decoration-rule underline-offset-2 transition-colors duration-200 hover:text-navy hover:decoration-navy'

type DespesaProxima = {
  id: string
  descricao: string
  categorias_financeiras: { nome: string } | null
  valor: number | null
  data_vencimento: string | null
}

type LancamentoResumo = { competencia: string | null; valor: number | null }

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarValorCompacto(valor: number) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  })
}

function formatarCompetenciaCurta(competencia: string) {
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano.slice(2)}`
}

function somarDias(dataIso: string, dias: number) {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

function diasEntre(dataInicio: string, dataFim: string) {
  const [a1, m1, d1] = dataInicio.split('-').map(Number)
  const [a2, m2, d2] = dataFim.split('-').map(Number)
  const inicio = Date.UTC(a1, m1 - 1, d1)
  const fim = Date.UTC(a2, m2 - 1, d2)
  return Math.round((fim - inicio) / (1000 * 60 * 60 * 24))
}

function somarMeses(competencia: string, meses: number) {
  const [anoStr, mesStr] = competencia.split('-')
  let ano = Number(anoStr)
  let mes = Number(mesStr) + meses

  while (mes > 12) {
    mes -= 12
    ano += 1
  }
  while (mes < 1) {
    mes += 12
    ano -= 1
  }

  return `${ano}-${String(mes).padStart(2, '0')}`
}

export default async function FinanceiroDashboardPage() {
  const supabase = await createClient()

  const hoje = new Date().toISOString().slice(0, 10)
  const daqui15Dias = somarDias(hoje, 15)
  const competenciaAtual = hoje.slice(0, 7)

  const mesesBalancete: string[] = []
  for (let i = 5; i >= 0; i--) {
    mesesBalancete.push(somarMeses(competenciaAtual, -i))
  }

  const inicioJanela = `${mesesBalancete[0]}-01`
  const fimJanela = `${competenciaAtual}-01`

  const [{ data: despesasProximas }, { data: receitasBalancete }, { data: despesasBalancete }] = await Promise.all([
    supabase
      .from('despesas')
      .select('id, descricao, categorias_financeiras(nome), valor, data_vencimento')
      .neq('status', 'pago')
      .gte('data_vencimento', hoje)
      .lte('data_vencimento', daqui15Dias)
      .order('data_vencimento', { ascending: true })
      .returns<DespesaProxima[]>(),
    supabase
      .from('receitas')
      .select('competencia, valor')
      .eq('status', 'recebido')
      .gte('competencia', inicioJanela)
      .lte('competencia', fimJanela)
      .returns<LancamentoResumo[]>(),
    supabase
      .from('despesas')
      .select('competencia, valor')
      .gte('competencia', inicioJanela)
      .lte('competencia', fimJanela)
      .returns<LancamentoResumo[]>(),
  ])

  const listaDespesasProximas = despesasProximas ?? []

  // Mesmo cálculo já usado na DRE (receita recebida - despesa total),
  // agora numa série histórica de 6 pontos em vez de um único mês.
  const receitaPorMes = new Map<string, number>()
  for (const receita of receitasBalancete ?? []) {
    if (!receita.competencia) continue
    const chave = receita.competencia.slice(0, 7)
    receitaPorMes.set(chave, (receitaPorMes.get(chave) ?? 0) + (receita.valor ?? 0))
  }

  const despesaPorMes = new Map<string, number>()
  for (const despesa of despesasBalancete ?? []) {
    if (!despesa.competencia) continue
    const chave = despesa.competencia.slice(0, 7)
    despesaPorMes.set(chave, (despesaPorMes.get(chave) ?? 0) + (despesa.valor ?? 0))
  }

  const serieBalancete = mesesBalancete.map((mes) => ({
    mes,
    resultado: (receitaPorMes.get(mes) ?? 0) - (despesaPorMes.get(mes) ?? 0),
  }))

  const mediaBalancete =
    serieBalancete.reduce((soma, item) => soma + item.resultado, 0) / (serieBalancete.length || 1)
  const mediaPositiva = mediaBalancete >= 0

  // Gráfico de barras divergente: SVG puro, mesma técnica do gráfico
  // Receita vs Despesa da DRE, mas com uma linha de base ao centro pra
  // permitir barra pra cima (mês positivo) ou pra baixo (mês negativo).
  const larguraGrafico = 480
  const alturaGrafico = 210
  const centroY = 100
  const alturaMaximaBarra = 70
  const larguraGrupo = larguraGrafico / serieBalancete.length
  const larguraBarra = 24

  const valorMaximoAbsoluto = Math.max(1, ...serieBalancete.map((item) => Math.abs(item.resultado)))

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">Dashboard Financeiro</h1>
      <p className="mb-8 text-sm text-navy-soft">Visão geral de vencimentos e resultado dos últimos meses</p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className={cardClasses}>
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-semibold text-navy">
                Próximas Despesas a Vencer
              </span>
              {listaDespesasProximas.length > 0 && (
                <span className="rounded-full bg-paper-dim px-2 py-0.5 font-mono text-[11px] font-normal text-navy-soft">
                  {listaDespesasProximas.length}
                </span>
              )}
            </div>
            <Link href="/admin/financeiro/despesas" className={atalhoClasses}>
              Ver todas
            </Link>
          </div>

          {listaDespesasProximas.length === 0 ? (
            <p className="py-6 text-center text-sm text-navy-soft">
              Nenhuma despesa vencendo nos próximos 15 dias. 🎉
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-rule">
              {listaDespesasProximas.map((despesa) => {
                const diasRestantes = despesa.data_vencimento ? diasEntre(hoje, despesa.data_vencimento) : 0
                const urgente = diasRestantes <= 3

                return (
                  <li key={despesa.id} className="flex items-center gap-3 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-navy">{despesa.descricao}</p>
                      <p className="truncate text-xs text-navy-soft">
                        {despesa.categorias_financeiras?.nome ?? 'Sem categoria'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-[12px] text-charcoal">
                        {formatarValor(despesa.valor ?? 0)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${
                          urgente
                            ? 'border border-red-200 bg-red-50 text-red-700'
                            : 'border border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {diasRestantes <= 0 ? 'Vence hoje' : diasRestantes === 1 ? '1 dia' : `${diasRestantes} dias`}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className={cardClasses}>
          <h2 className="mb-1 font-display text-base font-semibold text-navy">Evolução do Balancete</h2>
          <p className="mb-4 text-xs text-navy-soft">Resultado (receita − despesa) — últimos 6 meses</p>

          <svg viewBox={`0 0 ${larguraGrafico} ${alturaGrafico}`} className="w-full">
            <line x1="0" y1={centroY} x2={larguraGrafico} y2={centroY} stroke="var(--rule)" strokeWidth="1" />
            {serieBalancete.map((item, index) => {
              const xGrupo = index * larguraGrupo
              const positivo = item.resultado >= 0
              const alturaBarra = (Math.abs(item.resultado) / valorMaximoAbsoluto) * alturaMaximaBarra
              const xBarra = xGrupo + larguraGrupo / 2 - larguraBarra / 2
              const yBarra = positivo ? centroY - alturaBarra : centroY
              const yRotulo = positivo ? yBarra - 6 : yBarra + alturaBarra + 13

              return (
                <g key={item.mes}>
                  <rect
                    x={xBarra}
                    y={yBarra}
                    width={larguraBarra}
                    height={Math.max(alturaBarra, 1)}
                    rx="2"
                    fill={positivo ? '#8dc63f' : '#ef4444'}
                  />
                  <text
                    x={xGrupo + larguraGrupo / 2}
                    y={yRotulo}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--navy-soft)"
                  >
                    {formatarValorCompacto(item.resultado)}
                  </text>
                  <text
                    x={xGrupo + larguraGrupo / 2}
                    y={alturaGrafico - 6}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--navy-soft)"
                  >
                    {formatarCompetenciaCurta(item.mes)}
                  </text>
                </g>
              )
            })}
          </svg>

          <p className="mt-2 border-t border-rule pt-3 text-sm">
            <span className="text-navy-soft">Média dos últimos 6 meses: </span>
            <span className={`font-semibold ${mediaPositiva ? 'text-[#4f8f2a]' : 'text-red-600'}`}>
              {formatarValor(mediaBalancete)}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { ICONES } from '@/components/shared/icons'
import { CATEGORIAS_DESPESA, CATEGORIA_COR_GRAFICO } from '@/lib/constants/despesas'

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const cardClasses =
  'rounded-lg border border-rule bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md'

type CobrancaResumo = { competencia: string | null; valor: number | null }
type DespesaResumo = { competencia: string | null; categoria: string; valor: number | null }

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarCompetenciaExtenso(competencia: string) {
  const [ano, mes] = competencia.split('-').map(Number)
  return `${NOMES_MESES[mes - 1]}/${ano}`
}

function formatarCompetenciaCurta(competencia: string) {
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano.slice(2)}`
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

function IconeCard({ chave, className }: { chave: keyof typeof ICONES; className?: string }) {
  const Icon = ICONES[chave]
  return <Icon className={className ?? 'h-5 w-5'} />
}

export default async function DrePage({
  searchParams,
}: {
  searchParams: Promise<{ competencia?: string }>
}) {
  const { competencia: competenciaParam } = await searchParams

  const hoje = new Date().toISOString().slice(0, 7)
  const competenciaSelecionada = competenciaParam || hoje

  const mesesTendencia: string[] = []
  for (let i = 5; i >= 0; i--) {
    mesesTendencia.push(somarMeses(competenciaSelecionada, -i))
  }

  const inicioJanela = `${mesesTendencia[0]}-01`
  const fimJanela = `${competenciaSelecionada}-01`

  const supabase = await createClient()

  const [{ data: cobrancasJanela }, { data: despesasJanela }] = await Promise.all([
    supabase
      .from('cobrancas')
      .select('competencia, valor')
      .eq('status', 'pago')
      .gte('competencia', inicioJanela)
      .lte('competencia', fimJanela)
      .returns<CobrancaResumo[]>(),
    supabase
      .from('despesas')
      .select('competencia, categoria, valor')
      .gte('competencia', inicioJanela)
      .lte('competencia', fimJanela)
      .returns<DespesaResumo[]>(),
  ])

  const receitaPorMes = new Map<string, number>()
  for (const cobranca of cobrancasJanela ?? []) {
    if (!cobranca.competencia) continue
    const chave = cobranca.competencia.slice(0, 7)
    receitaPorMes.set(chave, (receitaPorMes.get(chave) ?? 0) + (cobranca.valor ?? 0))
  }

  const despesaPorMes = new Map<string, number>()
  const despesaPorCategoriaNoMes = new Map<string, number>()

  for (const despesa of despesasJanela ?? []) {
    if (!despesa.competencia) continue
    const chave = despesa.competencia.slice(0, 7)
    despesaPorMes.set(chave, (despesaPorMes.get(chave) ?? 0) + (despesa.valor ?? 0))

    if (chave === competenciaSelecionada) {
      despesaPorCategoriaNoMes.set(
        despesa.categoria,
        (despesaPorCategoriaNoMes.get(despesa.categoria) ?? 0) + (despesa.valor ?? 0)
      )
    }
  }

  const receitaMes = receitaPorMes.get(competenciaSelecionada) ?? 0
  const totalDespesasMes = despesaPorMes.get(competenciaSelecionada) ?? 0
  const resultadoMes = receitaMes - totalDespesasMes
  const resultadoPositivo = resultadoMes >= 0

  const serieTendencia = mesesTendencia.map((mes) => ({
    mes,
    receita: receitaPorMes.get(mes) ?? 0,
    despesas: despesaPorMes.get(mes) ?? 0,
  }))

  const valorMaximoTendencia = Math.max(1, ...serieTendencia.flatMap((item) => [item.receita, item.despesas]))

  // Gráfico de barras: SVG puro, sem biblioteca.
  const larguraGrafico = 480
  const alturaGrafico = 170
  const alturaBarras = 120
  const larguraGrupo = larguraGrafico / serieTendencia.length
  const larguraBarra = 20

  // Donut de categorias: mesma técnica de arcos sobrepostos via
  // stroke-dasharray usada no card de Adimplência do Dashboard.
  const raioDonut = 34
  const circunferenciaDonut = 2 * Math.PI * raioDonut

  const categoriasComArco = CATEGORIAS_DESPESA.map((categoria) => {
    const valor = despesaPorCategoriaNoMes.get(categoria.chave) ?? 0
    const percentual = totalDespesasMes > 0 ? valor / totalDespesasMes : 0
    const comprimentoArco = percentual * circunferenciaDonut
    return { ...categoria, valor, percentual, comprimentoArco }
  })

  const fatiasDonut = categoriasComArco
    .map((fatia, index) => ({
      ...fatia,
      offset: categoriasComArco
        .slice(0, index)
        .reduce((soma, anterior) => soma + anterior.comprimentoArco, 0),
    }))
    .filter((fatia) => fatia.valor > 0)

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">DRE</h1>
      <p className="mb-8 text-sm text-navy-soft">
        Demonstração do Resultado — {formatarCompetenciaExtenso(competenciaSelecionada)}
      </p>

      <form
        action="/admin/financeiro/dre"
        className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-rule bg-white p-4"
      >
        <div>
          <label
            htmlFor="competencia"
            className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft"
          >
            Competência
          </label>
          <input
            id="competencia"
            name="competencia"
            type="month"
            defaultValue={competenciaSelecionada}
            className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-sm text-charcoal outline-none focus:border-lime"
          />
        </div>
        <button
          type="submit"
          className="rounded-[3px] border-[1.3px] border-navy px-4 py-1.5 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper"
        >
          Ver DRE
        </button>
      </form>

      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className={cardClasses}>
          <div className="flex items-start justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">Receita Bruta</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime/10 text-[#4f8f2a]">
              <IconeCard chave="honorarios" className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 font-display text-2xl font-semibold text-navy">{formatarValor(receitaMes)}</p>
        </div>

        <div className={cardClasses}>
          <div className="flex items-start justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
              Total de Despesas
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <IconeCard chave="financeiro" className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 font-display text-2xl font-semibold text-navy">{formatarValor(totalDespesasMes)}</p>
        </div>

        <div className={cardClasses}>
          <div className="flex items-start justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
              Resultado do Mês
            </p>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                resultadoPositivo ? 'bg-lime/10 text-[#4f8f2a]' : 'bg-red-50 text-red-600'
              }`}
            >
              <IconeCard chave="dashboard" className="h-5 w-5" />
            </div>
          </div>
          <p
            className={`mt-3 font-display text-2xl font-semibold ${
              resultadoPositivo ? 'text-[#4f8f2a]' : 'text-red-600'
            }`}
          >
            {formatarValor(resultadoMes)}
          </p>
        </div>
      </div>

      <div className={`${cardClasses} mb-8`}>
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <span className="font-display text-base font-semibold text-navy">Receita Bruta (Honorários)</span>
          <span className="font-mono text-base font-semibold text-navy">{formatarValor(receitaMes)}</span>
        </div>

        <div className="mt-4">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
            (-) Despesas Operacionais
          </p>
          <ul className="divide-y divide-rule">
            {CATEGORIAS_DESPESA.map((categoria) => (
              <li key={categoria.chave} className="flex items-center justify-between py-2 pl-4 text-sm">
                <span className="text-charcoal">{categoria.label}</span>
                <span className="font-mono text-charcoal">
                  {formatarValor(despesaPorCategoriaNoMes.get(categoria.chave) ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-rule pt-3 pl-4 text-sm font-semibold">
            <span className="text-navy">Total de Despesas</span>
            <span className="font-mono text-navy">{formatarValor(totalDespesasMes)}</span>
          </div>
        </div>

        <div
          className={`mt-5 flex items-center justify-between rounded-lg px-4 py-3.5 ${
            resultadoPositivo ? 'bg-[#eef7e0]' : 'bg-red-50'
          }`}
        >
          <span className="font-display text-base font-semibold text-navy">Resultado do Mês</span>
          <span
            className={`font-display text-xl font-bold ${
              resultadoPositivo ? 'text-[#4f8f2a]' : 'text-red-600'
            }`}
          >
            {formatarValor(resultadoMes)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className={cardClasses}>
          <h2 className="mb-1 font-display text-base font-semibold text-navy">Receita vs Despesas</h2>
          <p className="mb-4 text-xs text-navy-soft">Últimos 6 meses</p>

          <div className="mb-3 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-lime" /> Receita
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Despesas
            </span>
          </div>

          <svg viewBox={`0 0 ${larguraGrafico} ${alturaGrafico}`} className="w-full">
            <line x1="0" y1={alturaBarras} x2={larguraGrafico} y2={alturaBarras} stroke="var(--rule)" strokeWidth="1" />
            {serieTendencia.map((item, index) => {
              const xGrupo = index * larguraGrupo
              const alturaReceita = (item.receita / valorMaximoTendencia) * (alturaBarras - 10)
              const alturaDespesa = (item.despesas / valorMaximoTendencia) * (alturaBarras - 10)
              const xReceita = xGrupo + larguraGrupo / 2 - larguraBarra - 2
              const xDespesa = xGrupo + larguraGrupo / 2 + 2

              return (
                <g key={item.mes}>
                  <rect
                    x={xReceita}
                    y={alturaBarras - alturaReceita}
                    width={larguraBarra}
                    height={alturaReceita}
                    rx="2"
                    fill="#8dc63f"
                  />
                  <rect
                    x={xDespesa}
                    y={alturaBarras - alturaDespesa}
                    width={larguraBarra}
                    height={alturaDespesa}
                    rx="2"
                    fill="#f59e0b"
                  />
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
        </div>

        <div className={cardClasses}>
          <h2 className="mb-1 font-display text-base font-semibold text-navy">Despesas por Categoria</h2>
          <p className="mb-4 text-xs text-navy-soft">{formatarCompetenciaExtenso(competenciaSelecionada)}</p>

          {totalDespesasMes === 0 ? (
            <p className="text-sm text-navy-soft">Nenhuma despesa lançada nesse mês.</p>
          ) : (
            <div className="flex items-center gap-5">
              <svg viewBox="0 0 96 96" className="h-24 w-24 shrink-0 -rotate-90">
                {fatiasDonut.map((fatia) => (
                  <circle
                    key={fatia.chave}
                    cx="48"
                    cy="48"
                    r={raioDonut}
                    fill="none"
                    stroke={CATEGORIA_COR_GRAFICO[fatia.chave]}
                    strokeWidth="12"
                    strokeDasharray={`${fatia.comprimentoArco} ${circunferenciaDonut - fatia.comprimentoArco}`}
                    strokeDashoffset={-fatia.offset}
                  />
                ))}
              </svg>

              <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
                {fatiasDonut.map((fatia) => (
                  <li key={fatia.chave} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: CATEGORIA_COR_GRAFICO[fatia.chave] }}
                      />
                      <span className="truncate text-navy-soft">{fatia.label}</span>
                    </span>
                    <span className="shrink-0 font-mono text-navy">
                      {Math.round(fatia.percentual * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

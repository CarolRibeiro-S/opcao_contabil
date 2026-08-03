import { createClient } from '@/lib/supabase/server'
import { ICONES } from '@/components/shared/icons'
import { obterEstiloCategoria } from '@/lib/constants/despesas'
import DRELinhaExpansivel, { type LancamentoDRE } from '@/components/admin/DRELinhaExpansivel'
import AdicionarCategoriaDRE from '@/components/admin/AdicionarCategoriaDRE'

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

type CategoriaFinanceira = { id: string; nome: string; tipo: string }

type ReceitaResumo = {
  id: string
  descricao: string
  categoria_id: string | null
  categorias_financeiras: { nome: string } | null
  valor: number | null
  competencia: string | null
  data_vencimento: string | null
  data_recebimento: string | null
  observacao: string | null
}

type DespesaResumo = {
  id: string
  descricao: string
  categoria_id: string | null
  categorias_financeiras: { nome: string } | null
  valor: number | null
  competencia: string | null
  data_vencimento: string | null
  data_pagamento: string | null
  observacao: string | null
}

type CategoriaDRE = {
  id: string
  nome: string
  total: number
  lancamentos: LancamentoDRE[]
}

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

function despesaParaLancamento(despesa: DespesaResumo): LancamentoDRE {
  return {
    id: despesa.id,
    descricao: despesa.descricao,
    valor: despesa.valor ?? 0,
    dataVencimento: despesa.data_vencimento,
    dataSecundaria: despesa.data_pagamento,
    observacao: despesa.observacao,
    editarHref: `/admin/financeiro/despesas/${despesa.id}/editar`,
  }
}

function receitaParaLancamento(receita: ReceitaResumo): LancamentoDRE {
  return {
    id: receita.id,
    descricao: receita.descricao,
    valor: receita.valor ?? 0,
    dataVencimento: receita.data_vencimento,
    dataSecundaria: receita.data_recebimento,
    observacao: receita.observacao,
    editarHref: `/admin/financeiro/receitas/${receita.id}/editar`,
  }
}

// Agrupa lançamentos por categoria pra montar as linhas expansíveis do DRE.
// Recebe a lista de categorias já cadastradas (categoriasBase) como ponto de
// partida — é isso que garante que uma categoria recém-criada, ainda sem
// nenhum lançamento na competência, apareça na lista mesmo assim (com
// R$ 0,00), em vez de só surgir quando o primeiro lançamento for feito nela.
function agruparPorCategoria<
  T extends { categoria_id: string | null; categorias_financeiras: { nome: string } | null },
>(categoriasBase: CategoriaFinanceira[], itens: T[], paraLancamento: (item: T) => LancamentoDRE): CategoriaDRE[] {
  const mapa = new Map<string, CategoriaDRE>()

  for (const categoria of categoriasBase) {
    mapa.set(categoria.id, { id: categoria.id, nome: categoria.nome, total: 0, lancamentos: [] })
  }

  for (const item of itens) {
    const chave = item.categoria_id ?? 'sem-categoria'
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        id: chave,
        nome: item.categorias_financeiras?.nome ?? 'Sem categoria',
        total: 0,
        lancamentos: [],
      })
    }

    const entrada = mapa.get(chave)!
    const lancamento = paraLancamento(item)
    entrada.total += lancamento.valor
    entrada.lancamentos.push(lancamento)
  }

  return Array.from(mapa.values()).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
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

  const [{ data: categoriasTodas }, { data: receitasJanela }, { data: despesasJanela }] = await Promise.all([
    supabase
      .from('categorias_financeiras')
      .select('id, nome, tipo')
      .order('nome', { ascending: true })
      .returns<CategoriaFinanceira[]>(),
    supabase
      .from('receitas')
      .select(
        'id, descricao, categoria_id, categorias_financeiras(nome), valor, competencia, data_vencimento, data_recebimento, observacao'
      )
      .eq('status', 'recebido')
      .gte('competencia', inicioJanela)
      .lte('competencia', fimJanela)
      .returns<ReceitaResumo[]>(),
    supabase
      .from('despesas')
      .select(
        'id, descricao, categoria_id, categorias_financeiras(nome), valor, competencia, data_vencimento, data_pagamento, observacao'
      )
      .gte('competencia', inicioJanela)
      .lte('competencia', fimJanela)
      .returns<DespesaResumo[]>(),
  ])

  const categoriasReceitaBase = (categoriasTodas ?? []).filter(
    (categoria) => categoria.tipo === 'receita' || categoria.tipo === 'ambos'
  )
  const categoriasDespesaBase = (categoriasTodas ?? []).filter(
    (categoria) => categoria.tipo === 'despesa' || categoria.tipo === 'ambos'
  )

  // Séries mensais (últimos 6 meses) pro gráfico de barras — somam todos os
  // lançamentos da janela, independente de categoria.
  const receitaPorMes = new Map<string, number>()
  for (const receita of receitasJanela ?? []) {
    if (!receita.competencia) continue
    const chave = receita.competencia.slice(0, 7)
    receitaPorMes.set(chave, (receitaPorMes.get(chave) ?? 0) + (receita.valor ?? 0))
  }

  const despesaPorMes = new Map<string, number>()
  for (const despesa of despesasJanela ?? []) {
    if (!despesa.competencia) continue
    const chave = despesa.competencia.slice(0, 7)
    despesaPorMes.set(chave, (despesaPorMes.get(chave) ?? 0) + (despesa.valor ?? 0))
  }

  // Lançamentos só da competência selecionada, agrupados por categoria —
  // base das seções expansíveis de Receitas e Despesas Operacionais.
  const receitasMes = (receitasJanela ?? []).filter(
    (receita) => receita.competencia?.slice(0, 7) === competenciaSelecionada
  )
  const despesasMes = (despesasJanela ?? []).filter(
    (despesa) => despesa.competencia?.slice(0, 7) === competenciaSelecionada
  )

  const categoriasReceitaDRE = agruparPorCategoria(categoriasReceitaBase, receitasMes, receitaParaLancamento)
  const categoriasDespesaDRE = agruparPorCategoria(categoriasDespesaBase, despesasMes, despesaParaLancamento)

  const receitaMes = categoriasReceitaDRE.reduce((soma, categoria) => soma + categoria.total, 0)
  const totalDespesasMes = categoriasDespesaDRE.reduce((soma, categoria) => soma + categoria.total, 0)
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
  // stroke-dasharray usada no card de Adimplência do Dashboard. Só entram
  // categorias com lançamento de fato na competência — categoria zerada não
  // rende fatia.
  const raioDonut = 34
  const circunferenciaDonut = 2 * Math.PI * raioDonut

  const categoriasComArco = categoriasDespesaDRE
    .filter((categoria) => categoria.total > 0)
    .map((categoria) => {
      const percentual = totalDespesasMes > 0 ? categoria.total / totalDespesasMes : 0
      const comprimentoArco = percentual * circunferenciaDonut
      return { ...categoria, percentual, comprimentoArco, ...obterEstiloCategoria(categoria.nome) }
    })

  const fatiasDonut = categoriasComArco.map((fatia, index) => ({
    ...fatia,
    offset: categoriasComArco.slice(0, index).reduce((soma, anterior) => soma + anterior.comprimentoArco, 0),
  }))

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">DRE</h1>
      <p className="mb-8 text-sm text-navy-soft">
        Demonstração do Resultado — {formatarCompetenciaExtenso(competenciaSelecionada)}
      </p>

      {/* mt-[37px]: alinha o início do conteúdo com a linha azul de
          navegação da sidebar (161px de altura do cabeçalho da sidebar,
          menos os 124px que padding-top do <main> (64px) + o bloco de
          título+descrição (60px: h1 + colapso de 8px + parágrafo) já
          ocupam — mesmo cálculo do Dashboard Financeiro/Histórico). */}
      <form
        action="/admin/financeiro/dre"
        className="mt-[37px] mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-rule bg-white p-4"
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

      <div className={`${cardClasses} mb-6`}>
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <span className="font-display text-base font-semibold text-navy">Receitas</span>
          <span className="font-mono text-base font-semibold text-navy">{formatarValor(receitaMes)}</span>
        </div>

        <ul className="mt-1 divide-y divide-rule pl-3">
          {categoriasReceitaDRE.length === 0 ? (
            <li className="py-3 text-sm text-navy-soft">Nenhuma categoria de receita cadastrada ainda.</li>
          ) : (
            categoriasReceitaDRE.map((categoria) => (
              <DRELinhaExpansivel
                key={categoria.id}
                nome={categoria.nome}
                total={categoria.total}
                lancamentos={categoria.lancamentos}
                badgeClasses={obterEstiloCategoria(categoria.nome).badgeClasses}
                labelDataSecundaria="Recebimento"
              />
            ))
          )}
        </ul>

        <div className="mt-2 pl-3">
          <AdicionarCategoriaDRE tipo="receita" />
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-rule pt-3 pl-3 text-sm font-semibold">
          <span className="text-navy">Receita Bruta Total</span>
          <span className="font-mono text-navy">{formatarValor(receitaMes)}</span>
        </div>
      </div>

      <div className={`${cardClasses} mb-6`}>
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <span className="font-display text-base font-semibold text-navy">Despesas Operacionais</span>
          <span className="font-mono text-base font-semibold text-navy">{formatarValor(totalDespesasMes)}</span>
        </div>

        <ul className="mt-1 divide-y divide-rule pl-3">
          {categoriasDespesaDRE.length === 0 ? (
            <li className="py-3 text-sm text-navy-soft">Nenhuma categoria de despesa cadastrada ainda.</li>
          ) : (
            categoriasDespesaDRE.map((categoria) => (
              <DRELinhaExpansivel
                key={categoria.id}
                nome={categoria.nome}
                total={categoria.total}
                lancamentos={categoria.lancamentos}
                badgeClasses={obterEstiloCategoria(categoria.nome).badgeClasses}
                labelDataSecundaria="Pagamento"
              />
            ))
          )}
        </ul>

        <div className="mt-2 pl-3">
          <AdicionarCategoriaDRE tipo="despesa" />
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-rule pt-3 pl-3 text-sm font-semibold">
          <span className="text-navy">Total de Despesas</span>
          <span className="font-mono text-navy">{formatarValor(totalDespesasMes)}</span>
        </div>
      </div>

      <div
        className={`mb-8 flex items-center justify-between rounded-lg px-5 py-4 shadow-sm ${
          resultadoPositivo ? 'bg-[#eef7e0]' : 'bg-red-50'
        }`}
      >
        <span className="font-display text-base font-semibold text-navy">Resultado do Mês</span>
        <span
          className={`font-display text-xl font-bold ${resultadoPositivo ? 'text-[#4f8f2a]' : 'text-red-600'}`}
        >
          {formatarValor(resultadoMes)}
        </span>
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
                    key={fatia.nome}
                    cx="48"
                    cy="48"
                    r={raioDonut}
                    fill="none"
                    stroke={fatia.cor}
                    strokeWidth="12"
                    strokeDasharray={`${fatia.comprimentoArco} ${circunferenciaDonut - fatia.comprimentoArco}`}
                    strokeDashoffset={-fatia.offset}
                  />
                ))}
              </svg>

              <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
                {fatiasDonut.map((fatia) => (
                  <li key={fatia.nome} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: fatia.cor }} />
                      <span className="truncate text-navy-soft">{fatia.nome}</span>
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

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AcoesReceita from '@/components/admin/AcoesReceita'
import { obterEstiloCategoria } from '@/lib/constants/despesas'
import {
  ORIGEM_RECEITA_BADGE,
  ORIGEM_RECEITA_LABEL,
  STATUS_RECEITA_BADGE,
  STATUS_RECEITA_LABEL,
} from '@/lib/constants/receitas'

type Receita = {
  id: string
  descricao: string
  categoria_id: string | null
  categorias_financeiras: { nome: string } | null
  valor: number | null
  competencia: string | null
  data_vencimento: string | null
  data_recebimento: string | null
  status: string
  origem: string
}

type CategoriaFiltro = { id: string; nome: string }

function formatarCompetencia(data: string | null) {
  if (!data) return '—'
  const [ano, mes] = data.split('-')
  return `${mes}/${ano}`
}

function formatarData(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarValor(valor: number | null) {
  if (valor === null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<{ competencia?: string; categoria_id?: string }>
}) {
  const { competencia: competenciaParam, categoria_id: categoriaIdParam } = await searchParams

  const supabase = await createClient()

  const { data: categoriasFiltro } = await supabase
    .from('categorias_financeiras')
    .select('id, nome')
    .in('tipo', ['receita', 'ambos'])
    .order('nome', { ascending: true })
    .returns<CategoriaFiltro[]>()

  const categoriaFiltro = (categoriasFiltro ?? []).some((item) => item.id === categoriaIdParam)
    ? (categoriaIdParam as string)
    : ''

  let query = supabase
    .from('receitas')
    .select(
      'id, descricao, categoria_id, categorias_financeiras(nome), valor, competencia, data_vencimento, data_recebimento, status, origem'
    )
    .order('competencia', { ascending: false })

  if (competenciaParam) {
    query = query.eq('competencia', `${competenciaParam}-01`)
  }

  if (categoriaFiltro) {
    query = query.eq('categoria_id', categoriaFiltro)
  }

  const { data: receitas } = await query.returns<Receita[]>()

  const temFiltro = !!competenciaParam || !!categoriaFiltro

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Receitas</h1>
        <Link
          href="/admin/financeiro/receitas/nova"
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
        >
          + Nova Receita
        </Link>
      </div>

      <form
        action="/admin/financeiro/receitas"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-rule bg-white p-4"
      >
        <div>
          <label htmlFor="competencia" className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
            Competência
          </label>
          <input
            id="competencia"
            name="competencia"
            type="month"
            defaultValue={competenciaParam ?? ''}
            className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-sm text-charcoal outline-none focus:border-lime"
          />
        </div>

        <div>
          <label htmlFor="categoria_id" className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
            Categoria
          </label>
          <select
            id="categoria_id"
            name="categoria_id"
            defaultValue={categoriaFiltro}
            className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-sm text-charcoal outline-none focus:border-lime"
          >
            <option value="">Todas</option>
            {(categoriasFiltro ?? []).map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-[3px] border-[1.3px] border-navy px-4 py-1.5 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper"
        >
          Filtrar
        </button>

        {temFiltro && (
          <Link
            href="/admin/financeiro/receitas"
            className="text-xs font-semibold text-navy-soft underline decoration-rule underline-offset-2 transition-colors duration-200 hover:text-navy hover:decoration-navy"
          >
            Limpar filtros
          </Link>
        )}
      </form>

      {!receitas || receitas.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhuma receita encontrada.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-paper-dim">
                <tr>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Descrição
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Categoria
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Valor
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Competência
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Vencimento
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Recebimento
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Status
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Origem
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {receitas.map((receita) => {
                  const nomeCategoria = receita.categorias_financeiras?.nome ?? null
                  const estiloCategoria = obterEstiloCategoria(nomeCategoria)

                  return (
                    <tr key={receita.id} className="border-t border-rule">
                      <td className="px-4 py-3 font-medium text-navy">{receita.descricao}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${estiloCategoria.badgeClasses}`}
                        >
                          {nomeCategoria ?? 'Sem categoria'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-charcoal">{formatarValor(receita.valor)}</td>
                      <td className="px-4 py-3 text-charcoal">{formatarCompetencia(receita.competencia)}</td>
                      <td className="px-4 py-3 text-charcoal">{formatarData(receita.data_vencimento)}</td>
                      <td className="px-4 py-3 text-charcoal">{formatarData(receita.data_recebimento)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                            STATUS_RECEITA_BADGE[receita.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                          }`}
                        >
                          {STATUS_RECEITA_LABEL[receita.status] ?? receita.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                            ORIGEM_RECEITA_BADGE[receita.origem] ?? 'border border-rule bg-paper-dim text-navy-soft'
                          }`}
                        >
                          {ORIGEM_RECEITA_LABEL[receita.origem] ?? receita.origem}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AcoesReceita
                          id={receita.id}
                          status={receita.status}
                          origem={receita.origem}
                          descricao={receita.descricao}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

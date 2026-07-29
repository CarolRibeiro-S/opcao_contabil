import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AcoesDespesa from '@/components/admin/AcoesDespesa'
import {
  CATEGORIAS_DESPESA,
  CATEGORIA_BADGE,
  CATEGORIA_LABEL,
  STATUS_DESPESA_BADGE,
  STATUS_DESPESA_LABEL,
} from '@/lib/constants/despesas'

type Despesa = {
  id: string
  descricao: string
  categoria: string
  valor: number | null
  competencia: string | null
  status: string
}

function formatarCompetencia(data: string | null) {
  if (!data) return '—'
  const [ano, mes] = data.split('-')
  return `${mes}/${ano}`
}

function formatarValor(valor: number | null) {
  if (valor === null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<{ competencia?: string; categoria?: string }>
}) {
  const { competencia: competenciaParam, categoria: categoriaParam } = await searchParams
  const categoriaFiltro = CATEGORIAS_DESPESA.some((item) => item.chave === categoriaParam)
    ? (categoriaParam as string)
    : ''

  const supabase = await createClient()

  let query = supabase
    .from('despesas')
    .select('id, descricao, categoria, valor, competencia, status')
    .order('competencia', { ascending: false })

  if (competenciaParam) {
    query = query.eq('competencia', `${competenciaParam}-01`)
  }

  if (categoriaFiltro) {
    query = query.eq('categoria', categoriaFiltro)
  }

  const { data: despesas } = await query.returns<Despesa[]>()

  const temFiltro = !!competenciaParam || !!categoriaFiltro

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Despesas</h1>
        <Link
          href="/admin/financeiro/despesas/nova"
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
        >
          + Nova Despesa
        </Link>
      </div>

      <form
        action="/admin/financeiro/despesas"
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
          <label htmlFor="categoria" className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
            Categoria
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue={categoriaFiltro}
            className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-sm text-charcoal outline-none focus:border-lime"
          >
            <option value="">Todas</option>
            {CATEGORIAS_DESPESA.map((categoria) => (
              <option key={categoria.chave} value={categoria.chave}>
                {categoria.label}
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
            href="/admin/financeiro/despesas"
            className="text-xs font-semibold text-navy-soft underline decoration-rule underline-offset-2 transition-colors duration-200 hover:text-navy hover:decoration-navy"
          >
            Limpar filtros
          </Link>
        )}
      </form>

      {!despesas || despesas.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhuma despesa encontrada.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
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
                    Status
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {despesas.map((despesa) => (
                  <tr key={despesa.id} className="border-t border-rule">
                    <td className="px-4 py-3 font-medium text-navy">{despesa.descricao}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                          CATEGORIA_BADGE[despesa.categoria] ?? 'border border-rule bg-paper-dim text-navy-soft'
                        }`}
                      >
                        {CATEGORIA_LABEL[despesa.categoria] ?? despesa.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-charcoal">{formatarValor(despesa.valor)}</td>
                    <td className="px-4 py-3 text-charcoal">{formatarCompetencia(despesa.competencia)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                          STATUS_DESPESA_BADGE[despesa.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                        }`}
                      >
                        {STATUS_DESPESA_LABEL[despesa.status] ?? despesa.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AcoesDespesa id={despesa.id} status={despesa.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

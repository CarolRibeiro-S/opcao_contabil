import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MarcarComoPago from '@/components/admin/MarcarComoPago'

type Cobranca = {
  id: string
  competencia: string | null
  valor: number | null
  status: string
  data_vencimento: string | null
  clientes: { nome_empresa: string } | null
}

const statusBadge: Record<string, string> = {
  em_aberto: 'bg-amber-50 text-amber-700 border border-amber-200',
  pago: 'bg-[#eef7e0] text-[#4f8f2a] border border-[#c8e2a1]',
  atrasado: 'bg-red-50 text-red-700 border border-red-200',
}

const statusLabel: Record<string, string> = {
  em_aberto: 'Em Aberto',
  pago: 'Pago',
  atrasado: 'Atrasado',
}

function formatarData(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
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

export default async function CobrancasPage() {
  const supabase = await createClient()

  const { data: cobrancas } = await supabase
    .from('cobrancas')
    .select('*, clientes(nome_empresa)')
    .order('data_vencimento', { ascending: true })
    .returns<Cobranca[]>()

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Cobranças</h1>
        <Link
          href="/admin/cobrancas/nova"
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
        >
          + Nova Cobrança
        </Link>
      </div>

      {!cobrancas || cobrancas.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhuma cobrança cadastrada ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-dim">
              <tr>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Cliente
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Competência
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Valor
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Vencimento
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
              {cobrancas.map((cobranca) => (
                <tr key={cobranca.id} className="border-t border-rule">
                  <td className="px-4 py-3 font-medium text-navy">
                    {cobranca.clientes?.nome_empresa ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-charcoal">{formatarCompetencia(cobranca.competencia)}</td>
                  <td className="px-4 py-3 text-charcoal">{formatarValor(cobranca.valor)}</td>
                  <td className="px-4 py-3 text-charcoal">{formatarData(cobranca.data_vencimento)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                        statusBadge[cobranca.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                      }`}
                    >
                      {statusLabel[cobranca.status] ?? cobranca.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/cobrancas/${cobranca.id}/editar`}
                        className="text-xs font-semibold text-navy-soft transition-colors duration-200 hover:text-navy"
                      >
                        Editar
                      </Link>
                      <MarcarComoPago id={cobranca.id} status={cobranca.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

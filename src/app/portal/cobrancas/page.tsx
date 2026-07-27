import { getClienteAtual } from '@/lib/portal/getClienteAtual'

type Cobranca = {
  id: string
  descricao: string | null
  competencia: string | null
  valor: number | null
  status: string
  data_vencimento: string | null
  data_pagamento: string | null
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

export default async function PortalCobrancasPage() {
  const { supabase, cliente } = await getClienteAtual()

  if (!cliente) {
    return (
      <p className="text-sm text-navy-soft">
        Não encontramos um cadastro de cliente vinculado à sua conta.
      </p>
    )
  }

  const { data: cobrancas } = await supabase
    .from('cobrancas')
    .select('id, descricao, competencia, valor, status, data_vencimento, data_pagamento')
    .eq('cliente_id', cliente.id)
    .order('data_vencimento', { ascending: true })
    .returns<Cobranca[]>()

  return (
    <div>
      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Honorários Contábeis</h1>

      {!cobrancas || cobrancas.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum honorário registrado ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-dim">
              <tr>
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
                  Pagamento
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {cobrancas.map((cobranca) => (
                <tr key={cobranca.id} className="border-t border-rule">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{formatarCompetencia(cobranca.competencia)}</p>
                    {cobranca.descricao && (
                      <p className="mt-0.5 text-xs text-navy-soft/70">{cobranca.descricao}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-charcoal">{formatarValor(cobranca.valor)}</td>
                  <td className="px-4 py-3 text-charcoal">{formatarData(cobranca.data_vencimento)}</td>
                  <td className="px-4 py-3 text-charcoal">{formatarData(cobranca.data_pagamento)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                        statusBadge[cobranca.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                      }`}
                    >
                      {statusLabel[cobranca.status] ?? cobranca.status}
                    </span>
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

import { getClienteAtual } from '@/lib/portal/getClienteAtual'

type Prazo = {
  id: string
  competencia: string | null
  data_vencimento: string | null
  status: string
  obrigacoes_acessorias: { nome: string } | null
}

const statusBadge: Record<string, string> = {
  pendente: 'bg-paper-dim text-navy-soft border border-rule',
  atencao: 'bg-amber-50 text-amber-700 border border-amber-200',
  em_dia: 'bg-[#eef7e0] text-[#4f8f2a] border border-[#c8e2a1]',
  vencido: 'bg-red-50 text-red-700 border border-red-200',
}

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  atencao: 'Atenção',
  em_dia: 'Em Dia',
  vencido: 'Vencido',
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

export default async function PortalPrazosPage() {
  const { supabase, cliente } = await getClienteAtual()

  if (!cliente) {
    return (
      <p className="text-sm text-navy-soft">
        Não encontramos um cadastro de cliente vinculado à sua conta.
      </p>
    )
  }

  const { data: prazos } = await supabase
    .from('prazos')
    .select('id, competencia, data_vencimento, status, obrigacoes_acessorias(nome)')
    .eq('cliente_id', cliente.id)
    .order('data_vencimento', { ascending: true })
    .returns<Prazo[]>()

  return (
    <div>
      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Prazos</h1>

      {!prazos || prazos.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum prazo cadastrado ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-dim">
              <tr>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Obrigação
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Competência
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Vencimento
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {prazos.map((prazo) => (
                <tr key={prazo.id} className="border-t border-rule">
                  <td className="px-4 py-3 font-medium text-navy">
                    {prazo.obrigacoes_acessorias?.nome ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-charcoal">{formatarCompetencia(prazo.competencia)}</td>
                  <td className="px-4 py-3 text-charcoal">{formatarData(prazo.data_vencimento)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                        statusBadge[prazo.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                      }`}
                    >
                      {statusLabel[prazo.status] ?? prazo.status}
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

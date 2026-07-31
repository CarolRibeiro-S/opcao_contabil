import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type Comunicado = {
  id: string
  titulo: string
  tipo: string
  status: string
  created_at: string
  clientes: { nome_empresa: string } | null
}

const tipoLabel: Record<string, string> = {
  aviso: 'Aviso',
  solicitacao_documento: 'Solicitação de Documento',
}

const tipoBadge: Record<string, string> = {
  aviso: 'bg-blue-50 text-blue-700 border border-blue-200',
  solicitacao_documento: 'bg-lime/15 text-[#4f8f2a] border border-lime/40',
}

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  respondido: 'Respondido',
  concluido: 'Concluído',
}

const statusBadge: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700 border border-amber-200',
  respondido: 'bg-blue-50 text-blue-700 border border-blue-200',
  concluido: 'bg-[#eef7e0] text-[#4f8f2a] border border-[#c8e2a1]',
}

// created_at vem em UTC do banco (timestamptz); precisa converter pro fuso
// de Brasília explicitamente — mesmo cuidado já usado em outras listagens
// que exibem timestamps (histórico, portal).
function formatarDataHora(iso: string) {
  const data = new Date(iso)
  const dataFormatada = data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const horaFormatada = data.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dataFormatada} ${horaFormatada}`
}

export default async function ComunicadosPage() {
  const supabase = await createClient()

  const { data: comunicados } = await supabase
    .from('comunicados')
    .select('id, titulo, tipo, status, created_at, clientes(nome_empresa)')
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<Comunicado[]>()

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Comunicados</h1>
          <p className="mt-1 text-sm text-navy-soft">Avisos e solicitações enviados aos clientes</p>
        </div>
        <Link
          href="/admin/comunicados/novo"
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
        >
          + Novo Comunicado
        </Link>
      </div>

      {!comunicados || comunicados.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum comunicado enviado ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-paper-dim">
                <tr>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Título
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Cliente
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Tipo
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Status
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Enviado em
                  </th>
                </tr>
              </thead>
              <tbody>
                {comunicados.map((comunicado) => (
                  <tr key={comunicado.id} className="border-t border-rule">
                    <td className="px-4 py-3 font-medium text-navy">{comunicado.titulo}</td>
                    <td className="px-4 py-3 text-charcoal">{comunicado.clientes?.nome_empresa ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                          tipoBadge[comunicado.tipo] ?? 'border border-rule bg-paper-dim text-navy-soft'
                        }`}
                      >
                        {tipoLabel[comunicado.tipo] ?? comunicado.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                          statusBadge[comunicado.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                        }`}
                      >
                        {statusLabel[comunicado.status] ?? comunicado.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-navy-soft">
                      {formatarDataHora(comunicado.created_at)}
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

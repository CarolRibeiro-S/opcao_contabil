import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AvancarStatusTarefa from '@/components/admin/AvancarStatusTarefa'

type Tarefa = {
  id: string
  titulo: string
  status: string
  data_limite: string | null
  clientes: { nome_empresa: string } | null
}

const statusBadge: Record<string, string> = {
  a_fazer: 'bg-paper-dim text-navy-soft border border-rule',
  em_andamento: 'bg-blue-50 text-blue-700 border border-blue-200',
  concluida: 'bg-[#eef7e0] text-[#4f8f2a] border border-[#c8e2a1]',
}

const statusLabel: Record<string, string> = {
  a_fazer: 'A Fazer',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
}

function formatarData(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export default async function TarefasPage() {
  const supabase = await createClient()

  const { data: tarefas } = await supabase
    .from('tarefas')
    .select('*, clientes(nome_empresa)')
    .order('data_limite', { ascending: true })
    .returns<Tarefa[]>()

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Tarefas</h1>
        <Link
          href="/admin/tarefas/nova"
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
        >
          + Nova Tarefa
        </Link>
      </div>

      {!tarefas || tarefas.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhuma tarefa cadastrada ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-paper-dim">
              <tr>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Título
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Cliente
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Status
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Data limite
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {tarefas.map((tarefa) => (
                <tr key={tarefa.id} className="border-t border-rule">
                  <td className="px-4 py-3 font-medium text-navy">{tarefa.titulo}</td>
                  <td className="px-4 py-3 text-charcoal">{tarefa.clientes?.nome_empresa ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                        statusBadge[tarefa.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                      }`}
                    >
                      {statusLabel[tarefa.status] ?? tarefa.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-charcoal">{formatarData(tarefa.data_limite)}</td>
                  <td className="px-4 py-3">
                    <AvancarStatusTarefa id={tarefa.id} status={tarefa.status} />
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

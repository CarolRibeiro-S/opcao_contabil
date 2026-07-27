import { getClienteAtual } from '@/lib/portal/getClienteAtual'
import ResponderComunicado from '@/components/portal/ResponderComunicado'

type Comunicado = {
  id: string
  titulo: string
  tipo: string
  mensagem: string
  status: string
  created_at: string
}

const tipoBadge: Record<string, string> = {
  aviso: 'bg-blue-50 text-blue-700 border border-blue-200',
  solicitacao_documento: 'bg-lime/15 text-[#4f8f2a] border border-lime/40',
}

const tipoLabel: Record<string, string> = {
  aviso: 'Aviso',
  solicitacao_documento: 'Solicitação de Documento',
}

const statusBadge: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700 border border-amber-200',
  respondido: 'bg-blue-50 text-blue-700 border border-blue-200',
  concluido: 'bg-[#eef7e0] text-[#4f8f2a] border border-[#c8e2a1]',
}

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  respondido: 'Respondido',
  concluido: 'Concluído',
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString('pt-BR')
}

export default async function PortalComunicadosPage() {
  const { supabase, cliente } = await getClienteAtual()

  if (!cliente) {
    return (
      <p className="text-sm text-navy-soft">
        Não encontramos um cadastro de cliente vinculado à sua conta.
      </p>
    )
  }

  const { data: comunicados } = await supabase
    .from('comunicados')
    .select('id, titulo, tipo, mensagem, status, created_at')
    .eq('cliente_id', cliente.id)
    .order('created_at', { ascending: false })
    .returns<Comunicado[]>()

  return (
    <div>
      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Comunicados</h1>

      {!comunicados || comunicados.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum comunicado recebido ainda.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {comunicados.map((comunicado) => (
            <div key={comunicado.id} className="rounded-lg border border-rule bg-white p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-navy">{comunicado.titulo}</h2>
                <span className="font-mono text-[11px] text-navy-soft">
                  {formatarData(comunicado.created_at)}
                </span>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                    tipoBadge[comunicado.tipo] ?? 'border border-rule bg-paper-dim text-navy-soft'
                  }`}
                >
                  {tipoLabel[comunicado.tipo] ?? comunicado.tipo}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                    statusBadge[comunicado.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                  }`}
                >
                  {statusLabel[comunicado.status] ?? comunicado.status}
                </span>
              </div>

              <p className="text-sm text-charcoal">{comunicado.mensagem}</p>

              {comunicado.tipo === 'solicitacao_documento' && comunicado.status === 'pendente' && (
                <ResponderComunicado comunicadoId={comunicado.id} clienteId={cliente.id} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

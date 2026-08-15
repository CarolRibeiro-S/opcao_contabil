import { getClienteAtual } from '@/lib/portal/getClienteAtual'
import ComunicadoThread from '@/components/portal/ComunicadoThread'

type Comunicado = {
  id: string
  titulo: string
  tipo: string
  mensagem: string
  status: string
  requer_resposta: boolean
  created_at: string
  visualizado_pelo_cliente_em: string | null
}

const tipoBadge: Record<string, string> = {
  aviso: 'bg-blue-50 text-blue-700 border border-blue-200',
  solicitacao_documento: 'bg-lime/15 text-success border border-lime/40',
}

const tipoLabel: Record<string, string> = {
  aviso: 'Aviso',
  solicitacao_documento: 'Solicitação de Documento',
}

const statusBadge: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700 border border-amber-200',
  respondido: 'bg-blue-50 text-blue-700 border border-blue-200',
  concluido: 'bg-success-bg text-success border border-success-border',
}

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  respondido: 'Respondido',
  concluido: 'Concluído',
}

// created_at vem em UTC do banco (timestamptz); precisa converter pro fuso
// de Brasília explicitamente, senão o dia exibido pode variar conforme o
// fuso do servidor — mesmo cuidado já usado em formatarDataHora (histórico).
function formatarData(data: string) {
  const dataObj = new Date(data)
  const dataFormatada = dataObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const horaFormatada = dataObj.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dataFormatada} às ${horaFormatada}`
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
    .select('id, titulo, tipo, mensagem, status, requer_resposta, created_at, visualizado_pelo_cliente_em')
    .eq('cliente_id', cliente.id)
    .order('created_at', { ascending: false })
    .returns<Comunicado[]>()

  return (
    <div>
      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Comunicados</h1>

      {/* mt-[83px]: mesmo valor (e mesmo cálculo) já usado na grade de cards
          da Home do Portal — alinha o início do conteúdo com a linha azul
          de navegação da sidebar. Estrutura idêntica à da Home (h1 sozinho,
          1 linha, mb-8), então o mesmo valor se aplica sem recálculo. */}
      <div className="mt-[83px]">
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

              <div className="mt-3">
                <ComunicadoThread
                  comunicadoId={comunicado.id}
                  clienteId={cliente.id}
                  tipoComunicado={comunicado.tipo === 'solicitacao_documento' ? 'solicitacao_documento' : 'aviso'}
                  tituloComunicado={comunicado.titulo}
                  nomeCliente={cliente.nome_empresa}
                  statusComunicado={comunicado.status}
                  requerResposta={comunicado.requer_resposta}
                  visualizadoPeloClienteEm={comunicado.visualizado_pelo_cliente_em}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

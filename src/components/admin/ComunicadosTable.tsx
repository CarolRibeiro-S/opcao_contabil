'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { IconChevron } from '@/components/shared/icons'
import ThreadComunicado from '@/components/shared/ThreadComunicado'

type Comunicado = {
  id: string
  cliente_id: string
  titulo: string
  tipo: string
  status: string
  requer_resposta: boolean
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
  return `${dataFormatada} às ${horaFormatada}`
}

export default function ComunicadosTable({ comunicados }: { comunicados: Comunicado[] }) {
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const linhasRef = useRef<Record<string, HTMLTableRowElement | null>>({})

  useEffect(() => {
    // Lido do window.location (não useSearchParams) de propósito — mesma
    // técnica já usada em /login e /verificar-codigo: evita exigir Suspense
    // boundary só pra abrir direto numa conversa específica quando se chega
    // aqui pelo link "Ver conversa" dos cards de Comunicados do Dashboard.
    const params = new URLSearchParams(window.location.search)
    const idDestacado = params.get('comunicado')

    if (!idDestacado || !comunicados.some((comunicado) => comunicado.id === idDestacado)) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandidoId(idDestacado)
    linhasRef.current[idDestacado]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
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
              <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft" />
            </tr>
          </thead>
          <tbody>
            {comunicados.map((comunicado) => {
              const aberto = expandidoId === comunicado.id
              return (
                <Fragment key={comunicado.id}>
                  <tr
                    ref={(el) => {
                      linhasRef.current[comunicado.id] = el
                    }}
                    onClick={() => setExpandidoId(aberto ? null : comunicado.id)}
                    aria-expanded={aberto}
                    className={`cursor-pointer border-t border-rule transition-colors duration-200 hover:bg-paper-dim ${
                      aberto ? 'bg-paper-dim' : ''
                    }`}
                  >
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
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy-soft">
                        {aberto ? 'Ocultar' : 'Ver conversa'}
                        <IconChevron
                          className={`h-3 w-3 transition-transform duration-200 ${aberto ? 'rotate-90' : ''}`}
                        />
                      </span>
                    </td>
                  </tr>

                  {aberto && (
                    <tr className="border-t border-rule bg-paper-dim">
                      <td colSpan={6} className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <ThreadComunicado
                          comunicadoId={comunicado.id}
                          clienteId={comunicado.cliente_id}
                          tipoComunicado={comunicado.tipo === 'solicitacao_documento' ? 'solicitacao_documento' : 'aviso'}
                          autorTipo="admin"
                          tituloComunicado={comunicado.titulo}
                          nomeCliente={comunicado.clientes?.nome_empresa ?? 'Cliente'}
                          statusAtual={comunicado.status}
                          requerResposta={comunicado.requer_resposta}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

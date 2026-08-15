'use client'

import { useMemo, useState } from 'react'

export type ItemEnvio = {
  id: string
  categoria: 'comunicado' | 'documento' | 'solicitacao_mensal'
  clienteId: string
  clienteNome: string
  descricao: string
  dataEnvio: string
  visualizadoEm: string | null
}

const categoriaLabel: Record<ItemEnvio['categoria'], string> = {
  comunicado: 'Comunicado',
  documento: 'Documento',
  solicitacao_mensal: 'Solicitação Mensal',
}

const categoriaBadge: Record<ItemEnvio['categoria'], string> = {
  comunicado: 'bg-blue-50 text-blue-700 border border-blue-200',
  documento: 'bg-lime/15 text-success border border-lime/40',
  solicitacao_mensal: 'border border-rule bg-paper-dim text-navy-soft',
}

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

export default function ControleEnviosTabela({ itens }: { itens: ItemEnvio[] }) {
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [soNaoVisualizados, setSoNaoVisualizados] = useState(false)

  const clientes = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const item of itens) mapa.set(item.clienteId, item.clienteNome)
    return Array.from(mapa.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [itens])

  const itensFiltrados = itens.filter((item) => {
    if (clienteFiltro && item.clienteId !== clienteFiltro) return false
    if (soNaoVisualizados && item.visualizadoEm) return false
    return true
  })

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
          className="rounded-[3px] border border-rule bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-lime"
        >
          <option value="">Todos os clientes</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nome}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="checkbox"
            checked={soNaoVisualizados}
            onChange={(e) => setSoNaoVisualizados(e.target.checked)}
            className="h-4 w-4 accent-lime"
          />
          Só não visualizados
        </label>

        <span className="ml-auto text-xs text-navy-soft">
          {itensFiltrados.length} de {itens.length} envio(s)
        </span>
      </div>

      {itensFiltrados.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum envio encontrado com esse filtro.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-paper-dim">
                <tr>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Cliente
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Tipo
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Descrição
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Enviado em
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.map((item) => (
                  <tr key={item.id} className="border-t border-rule">
                    <td className="px-4 py-3 font-medium text-navy">{item.clienteNome}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${categoriaBadge[item.categoria]}`}
                      >
                        {categoriaLabel[item.categoria]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-charcoal">{item.descricao}</td>
                    <td className="px-4 py-3 text-charcoal">{formatarDataHora(item.dataEnvio)}</td>
                    <td className="px-4 py-3">
                      {item.visualizadoEm ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-border bg-success-bg px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-success">
                          Visto em {formatarDataHora(item.visualizadoEm)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-amber-700">
                          Não visto
                        </span>
                      )}
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

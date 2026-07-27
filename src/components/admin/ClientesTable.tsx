'use client'

import { useState } from 'react'
import Link from 'next/link'
import ToggleStatusButton from './ToggleStatusButton'

type Cliente = {
  id: string
  nome_empresa: string
  tipo: string
  segmento: string | null
  status: string
  telefone: string | null
}

const tipoBadge: Record<string, string> = {
  pessoa_juridica: 'bg-blue-50 text-blue-700 border border-blue-200',
  mei: 'bg-lime/15 text-[#4f8f2a] border border-lime/40',
}

const tipoLabel: Record<string, string> = {
  pessoa_juridica: 'Pessoa Jurídica',
  mei: 'MEI',
}

const statusBadge: Record<string, string> = {
  ativo: 'bg-[#eef7e0] text-[#4f8f2a] border border-[#c8e2a1]',
  inativo: 'bg-paper-dim text-navy-soft border border-rule',
}

export default function ClientesTable({ clientes }: { clientes: Cliente[] }) {
  const [busca, setBusca] = useState('')

  const termo = busca.trim().toLowerCase()
  const clientesFiltrados = termo
    ? clientes.filter(
        (cliente) =>
          cliente.nome_empresa.toLowerCase().includes(termo) ||
          (cliente.segmento ?? '').toLowerCase().includes(termo)
      )
    : clientes

  return (
    <div>
      <input
        type="search"
        placeholder="Buscar por empresa ou segmento..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-5 w-full max-w-sm rounded-[3px] border border-rule bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors duration-200 focus:border-lime"
      />

      {clientesFiltrados.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum cliente encontrado para essa busca.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-dim">
              <tr>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Empresa
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Tipo
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Segmento
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Status
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Telefone
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((cliente) => (
                <tr key={cliente.id} className="border-t border-rule">
                  <td className="px-4 py-3 font-medium text-navy">{cliente.nome_empresa}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                        tipoBadge[cliente.tipo] ?? 'border border-rule bg-paper-dim text-navy-soft'
                      }`}
                    >
                      {tipoLabel[cliente.tipo] ?? cliente.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-charcoal">{cliente.segmento ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                        statusBadge[cliente.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                      }`}
                    >
                      {cliente.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-charcoal">{cliente.telefone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/clientes/${cliente.id}/editar`}
                        className="text-xs font-semibold text-navy-soft transition-colors duration-200 hover:text-navy"
                      >
                        Editar
                      </Link>
                      <ToggleStatusButton id={cliente.id} status={cliente.status} />
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

'use client'

import { useState } from 'react'
import AcoesCliente from './AcoesCliente'

type Cliente = {
  id: string
  codigo_interno: number | null
  cnpj_cpf: string | null
  nome_empresa: string
  tipo: string
  segmento: string | null
  status: string
  responsavel: string | null
  telefone: string | null
  regime_tributario: string | null
  profile_id: string | null
}

const tipoBadge: Record<string, string> = {
  pessoa_juridica: 'bg-blue-50 text-blue-700 border border-blue-200',
  mei: 'bg-lime/15 text-success border border-lime/40',
}

const tipoLabel: Record<string, string> = {
  pessoa_juridica: 'PJ',
  mei: 'MEI',
}

const regimeLabel: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  sociedade_sem_fins_lucrativos: 'Sociedade sem fins lucrativos',
}

const statusBadge: Record<string, string> = {
  ativo: 'bg-success-bg text-success border border-success-border',
  inativo: 'bg-paper-dim text-navy-soft border border-rule',
}

export default function ClientesTable({ clientes }: { clientes: Cliente[] }) {
  const [busca, setBusca] = useState('')

  const termo = busca.trim().toLowerCase()
  const clientesFiltrados = termo
    ? clientes.filter(
        (cliente) =>
          cliente.nome_empresa.toLowerCase().includes(termo) ||
          (cliente.segmento ?? '').toLowerCase().includes(termo) ||
          (cliente.codigo_interno !== null && String(cliente.codigo_interno).includes(termo))
      )
    : clientes

  return (
    <div>
      <input
        type="search"
        placeholder="Buscar por código, empresa ou segmento..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-5 w-full max-w-sm rounded-[3px] border border-rule bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors duration-200 focus:border-lime"
      />

      {clientesFiltrados.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum cliente encontrado para essa busca.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-paper-dim">
              <tr>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  Código
                </th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                  CNPJ
                </th>
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
                  Responsável
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
                  <td className="px-4 py-3 font-mono text-charcoal">{cliente.codigo_interno ?? '—'}</td>
                  <td className="px-4 py-3 text-charcoal">{cliente.cnpj_cpf ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-navy">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        title={cliente.profile_id ? 'Acesso ao portal ativo' : 'Ainda não convidado pro portal'}
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          cliente.profile_id ? 'bg-success' : 'bg-navy-soft/30'
                        }`}
                      />
                      {cliente.nome_empresa}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                          tipoBadge[cliente.tipo] ?? 'border border-rule bg-paper-dim text-navy-soft'
                        }`}
                      >
                        {tipoLabel[cliente.tipo] ?? cliente.tipo}
                      </span>
                      {cliente.regime_tributario && (
                        <span className="rounded-full border border-rule bg-paper-dim px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-navy-soft">
                          {regimeLabel[cliente.regime_tributario] ?? cliente.regime_tributario}
                        </span>
                      )}
                    </div>
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
                  <td className="px-4 py-3 text-charcoal">{cliente.responsavel ?? '—'}</td>
                  <td className="px-4 py-3 text-charcoal">{cliente.telefone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <AcoesCliente id={cliente.id} nome={cliente.nome_empresa} status={cliente.status} />
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

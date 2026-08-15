'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ICONES } from '@/components/shared/icons'

type ComunicadoResumo = {
  id: string
  cliente_id: string
  titulo: string
  status: string
  created_at: string
  clientes: { nome_empresa: string } | null
}

const COLUNAS: { status: string; label: string }[] = [
  { status: 'pendente', label: 'Pendente' },
  { status: 'respondido', label: 'Em Andamento' },
  { status: 'concluido', label: 'Concluído' },
]

const corColuna: Record<string, string> = {
  pendente: 'border-amber-200 bg-amber-50 text-amber-700',
  respondido: 'border-blue-200 bg-blue-50 text-blue-700',
  concluido: 'border-success-border bg-success-bg text-success',
}

const cardClasses = 'rounded-lg border border-rule bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md'

const inputClasses =
  'w-full rounded-[3px] border border-rule bg-white px-2.5 py-1.5 text-xs text-charcoal outline-none transition-colors duration-200 focus:border-lime'

function IconeCard({ chave, className }: { chave: keyof typeof ICONES; className?: string }) {
  const Icon = ICONES[chave]
  return <Icon className={className ?? 'h-5 w-5'} />
}

// created_at vem em UTC do banco (timestamptz); precisa converter pro fuso
// de Brasília explicitamente — mesmo cuidado já usado em outras listagens
// que exibem timestamps (histórico, portal, comunicados).
function formatarData(iso: string) {
  const data = new Date(iso)
  const dataFormatada = data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const horaFormatada = data.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dataFormatada} às ${horaFormatada}`
}

// Formato YYYY-MM-DD no fuso de Brasília — comparável direto com o value de
// um <input type="date"> (que também usa YYYY-MM-DD), sem depender de
// horário/fuso do navegador de quem está usando o Dashboard.
function dataLocalYMD(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

export default function CardComunicados({
  titulo,
  icone,
  comunicados,
}: {
  titulo: string
  icone: keyof typeof ICONES
  comunicados: ComunicadoResumo[]
}) {
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const filtrados = useMemo(() => {
    const termo = clienteFiltro.trim().toLowerCase()

    return comunicados.filter((comunicado) => {
      if (termo && !(comunicado.clientes?.nome_empresa ?? '').toLowerCase().includes(termo)) {
        return false
      }

      const dataComunicado = dataLocalYMD(comunicado.created_at)
      if (dataInicio && dataComunicado < dataInicio) return false
      if (dataFim && dataComunicado > dataFim) return false

      return true
    })
  }, [comunicados, clienteFiltro, dataInicio, dataFim])

  return (
    <div className={cardClasses}>
      <div className="mb-4 flex items-start justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-navy">
          {titulo}
          <span className="rounded-full bg-paper-dim px-2 py-0.5 font-mono text-[11px] font-normal text-navy-soft">
            {filtrados.length}
          </span>
        </h2>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy">
          <IconeCard chave={icone} className="h-5 w-5" />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Filtrar por cliente..."
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
          className={`${inputClasses} max-w-[180px] flex-1`}
        />
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          aria-label="Data inicial"
          className={`${inputClasses} w-[132px]`}
        />
        <span className="text-xs text-navy-soft">até</span>
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          aria-label="Data final"
          className={`${inputClasses} w-[132px]`}
        />
        {(clienteFiltro || dataInicio || dataFim) && (
          <button
            type="button"
            onClick={() => {
              setClienteFiltro('')
              setDataInicio('')
              setDataFim('')
            }}
            className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {COLUNAS.map((coluna) => {
          const itens = filtrados.filter((comunicado) => comunicado.status === coluna.status)

          return (
            <div key={coluna.status} className="min-w-0">
              <div
                className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${
                  corColuna[coluna.status]
                }`}
              >
                {coluna.label} · {itens.length}
              </div>

              {itens.length === 0 ? (
                <p className="py-3 text-xs text-navy-soft">Nenhum comunicado.</p>
              ) : (
                <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
                  {itens.map((comunicado) => (
                    <li key={comunicado.id} className="rounded-md border border-rule bg-paper-dim px-2.5 py-2">
                      <p className="truncate text-xs font-medium text-navy">
                        {comunicado.clientes?.nome_empresa ?? '—'}
                      </p>
                      <p className="truncate text-[11px] text-navy-soft">{comunicado.titulo}</p>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <span className="font-mono text-[10px] text-navy-soft">
                          {formatarData(comunicado.created_at)}
                        </span>
                        <Link
                          href={`/admin/comunicados?comunicado=${comunicado.id}`}
                          className="shrink-0 text-[11px] font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
                        >
                          Ver conversa
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

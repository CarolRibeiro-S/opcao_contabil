'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ICONES } from '@/components/shared/icons'

type ComunicadoResumo = {
  id: string
  titulo: string
  status: string
  created_at: string
}

const COLUNAS: { status: string; label: string }[] = [
  { status: 'pendente', label: 'Pendente' },
  { status: 'respondido', label: 'Em Andamento' },
  { status: 'concluido', label: 'Concluído' },
]

const corColuna: Record<string, string> = {
  pendente: 'border-amber-200 bg-amber-50 text-amber-700',
  respondido: 'border-blue-200 bg-blue-50 text-blue-700',
  concluido: 'border-[#c8e2a1] bg-[#eef7e0] text-[#4f8f2a]',
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
// um <input type="date"> (que também usa YYYY-MM-DD).
function dataLocalYMD(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

// Versão do CardComunicados (Admin) adaptada pro Dashboard do Portal: já são
// só os comunicados de UM cliente (o logado), então não faz sentido o filtro
// por nome de cliente nem o link pra tela de Comunicados do Admin — mantive
// só o filtro por data.
export default function CardComunicadosPortal({
  titulo,
  icone,
  comunicados,
}: {
  titulo: string
  icone: keyof typeof ICONES
  comunicados: ComunicadoResumo[]
}) {
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const filtrados = useMemo(() => {
    return comunicados.filter((comunicado) => {
      const dataComunicado = dataLocalYMD(comunicado.created_at)
      if (dataInicio && dataComunicado < dataInicio) return false
      if (dataFim && dataComunicado > dataFim) return false
      return true
    })
  }, [comunicados, dataInicio, dataFim])

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
        {(dataInicio || dataFim) && (
          <button
            type="button"
            onClick={() => {
              setDataInicio('')
              setDataFim('')
            }}
            className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
          >
            Limpar
          </button>
        )}
      </div>

      {/* lg: em vez de sm: (usado no card do Admin) — no Portal, os dois
          cards de comunicados já dividem a largura da tela em 2 (ver
          portal/page.tsx: xl:grid-cols-2), então forçar 3 colunas a partir
          de sm: (640px) apertava demais cada uma. Com lg:, as colunas só
          viram 3-a-3 quando sobra espaço de verdade — em telas menores,
          ficam empilhadas (1 por linha), sem disputar espaço. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {COLUNAS.map((coluna) => {
          const itens = filtrados.filter((comunicado) => comunicado.status === coluna.status)

          return (
            <div key={coluna.status} className="min-w-0">
              <div
                className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${
                  corColuna[coluna.status]
                }`}
              >
                {coluna.label} · {itens.length}
              </div>

              {itens.length === 0 ? (
                <p className="py-3 text-xs text-navy-soft">Nenhum comunicado.</p>
              ) : (
                <ul className="flex min-w-0 max-h-72 flex-col gap-2.5 overflow-y-auto overflow-x-hidden pr-1">
                  {itens.map((comunicado) => (
                    <li
                      key={comunicado.id}
                      className="min-w-0 rounded-md border border-rule bg-paper-dim px-3.5 py-3"
                    >
                      {/* break-words em vez de truncate: título comprido
                          quebra linha dentro da coluna, em vez de cortar com
                          "..." ou empurrar a linha pra rolagem horizontal. */}
                      <p className="break-words text-xs font-medium leading-snug text-navy">
                        {comunicado.titulo}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <span className="font-mono text-[10px] text-navy-soft">
                          {formatarData(comunicado.created_at)}
                        </span>
                        <Link
                          href="/portal/comunicados"
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

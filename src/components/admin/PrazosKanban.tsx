'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Prazo = {
  id: string
  competencia: string | null
  data_vencimento: string | null
  status: string
  clientes: { nome_empresa: string } | null
  obrigacoes_acessorias: { nome: string } | null
}

const COLUNAS = [
  { status: 'pendente', titulo: 'Pendente', corBadge: 'bg-paper-dim text-navy-soft', corBorda: 'border-l-rule' },
  {
    status: 'em_dia',
    titulo: 'Em Dia',
    corBadge: 'bg-[#eef7e0] text-[#4f8f2a]',
    corBorda: 'border-l-[#4f8f2a]',
  },
  { status: 'vencido', titulo: 'Vencido', corBadge: 'bg-red-50 text-red-700', corBorda: 'border-l-red-500' },
] as const

function formatarData(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarCompetencia(data: string | null) {
  if (!data) return '—'
  const [ano, mes] = data.split('-')
  return `${mes}/${ano}`
}

export default function PrazosKanban({ prazos: prazosIniciais }: { prazos: Prazo[] }) {
  const [prazos, setPrazos] = useState(prazosIniciais)
  const supabase = createClient()

  async function moverStatus(id: string, novoStatus: string) {
    const statusAnterior = prazos.find((prazo) => prazo.id === id)?.status
    if (!statusAnterior) return

    setPrazos((atual) => atual.map((prazo) => (prazo.id === id ? { ...prazo, status: novoStatus } : prazo)))

    const { error } = await supabase.from('prazos').update({ status: novoStatus }).eq('id', id)

    if (error) {
      setPrazos((atual) =>
        atual.map((prazo) => (prazo.id === id ? { ...prazo, status: statusAnterior } : prazo))
      )
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {COLUNAS.map((coluna, colunaIndex) => {
        const prazosDaColuna = prazos.filter((prazo) => prazo.status === coluna.status)

        return (
          <div key={coluna.status} className="flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-navy">{coluna.titulo}</h2>
              <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${coluna.corBadge}`}>
                {prazosDaColuna.length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {prazosDaColuna.length === 0 ? (
                <p className="text-sm text-navy-soft/70">Nenhum prazo aqui.</p>
              ) : (
                prazosDaColuna.map((prazo) => (
                  <div
                    key={prazo.id}
                    className={`rounded-lg border border-t-rule border-r-rule border-b-rule border-l-4 ${coluna.corBorda} bg-white p-4 shadow-sm`}
                  >
                    <p className="font-display text-sm font-semibold text-navy">
                      {prazo.obrigacoes_acessorias?.nome ?? '—'}
                    </p>
                    <p className="mt-1 text-sm text-charcoal">{prazo.clientes?.nome_empresa ?? '—'}</p>
                    <p className="mt-2 font-mono text-[11px] text-navy-soft">
                      Competência: {formatarCompetencia(prazo.competencia)}
                    </p>
                    <p className="font-mono text-[11px] text-navy-soft">
                      Vencimento: {formatarData(prazo.data_vencimento)}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-rule pt-2.5">
                      <button
                        type="button"
                        onClick={() => moverStatus(prazo.id, COLUNAS[colunaIndex - 1].status)}
                        disabled={colunaIndex === 0}
                        aria-label={`Mover para ${COLUNAS[colunaIndex - 1]?.titulo ?? ''}`}
                        className="text-sm font-semibold text-navy-soft transition-colors duration-200 hover:text-navy disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moverStatus(prazo.id, COLUNAS[colunaIndex + 1].status)}
                        disabled={colunaIndex === COLUNAS.length - 1}
                        aria-label={`Mover para ${COLUNAS[colunaIndex + 1]?.titulo ?? ''}`}
                        className="text-sm font-semibold text-navy-soft transition-colors duration-200 hover:text-navy disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

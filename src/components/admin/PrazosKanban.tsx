'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'
import AcoesPrazo from '@/components/admin/AcoesPrazo'

type Prazo = {
  id: string
  competencia: string | null
  data_vencimento: string | null
  status: string
  comprovante_url: string | null
  entregue_em: string | null
  clientes: { nome_empresa: string } | null
  obrigacoes_acessorias: { nome: string } | null
}

const BUCKET_COMPROVANTES = 'documentos-clientes'

function IconCheck({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  )
}

const COLUNAS = [
  { status: 'pendente', titulo: 'Pendente', corBadge: 'bg-paper-dim text-navy-soft', corBorda: 'border-l-rule' },
  {
    status: 'atencao',
    titulo: 'Atenção',
    corBadge: 'bg-amber-50 text-amber-700',
    corBorda: 'border-l-amber-500',
  },
  {
    status: 'em_dia',
    titulo: 'Em Dia',
    corBadge: 'bg-success-bg text-success',
    corBorda: 'border-l-success',
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

export default function PrazosKanban({ prazos: prazosIniciais }: { prazos: Prazo[] }) {
  const [prazos, setPrazos] = useState(prazosIniciais)
  const supabase = createClient()

  async function moverStatus(id: string, novoStatus: string) {
    const prazo = prazos.find((prazo) => prazo.id === id)
    const statusAnterior = prazo?.status
    if (!prazo || !statusAnterior) return

    setPrazos((atual) => atual.map((prazo) => (prazo.id === id ? { ...prazo, status: novoStatus } : prazo)))

    const { error } = await supabase.from('prazos').update({ status: novoStatus }).eq('id', id)

    if (error) {
      setPrazos((atual) =>
        atual.map((prazo) => (prazo.id === id ? { ...prazo, status: statusAnterior } : prazo))
      )
      return
    }

    const tituloAnterior = COLUNAS.find((coluna) => coluna.status === statusAnterior)?.titulo ?? statusAnterior
    const tituloNovo = COLUNAS.find((coluna) => coluna.status === novoStatus)?.titulo ?? novoStatus

    registrarHistoricoAtividade({
      acao: 'moveu_prazo',
      entidade: 'prazo',
      entidadeId: id,
      entidadeNome: `${prazo.obrigacoes_acessorias?.nome ?? 'Obrigação'} — ${prazo.clientes?.nome_empresa ?? 'Cliente'}`,
      detalhes: `${tituloAnterior} → ${tituloNovo}`,
    })
  }

  function comprovanteAnexado(id: string, comprovanteUrl: string, entregueEm: string) {
    setPrazos((atual) =>
      atual.map((prazo) =>
        prazo.id === id
          ? { ...prazo, comprovante_url: comprovanteUrl, entregue_em: entregueEm, status: 'em_dia' }
          : prazo
      )
    )
  }

  function comprovanteRemovido(id: string) {
    setPrazos((atual) =>
      atual.map((prazo) => (prazo.id === id ? { ...prazo, comprovante_url: null, entregue_em: null } : prazo))
    )
  }

  async function verComprovante(caminhoArquivo: string) {
    const { data } = await supabase.storage.from(BUCKET_COMPROVANTES).createSignedUrl(caminhoArquivo, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
      {COLUNAS.map((coluna, colunaIndex) => {
        const prazosDaColuna = prazos.filter((prazo) => prazo.status === coluna.status)

        return (
          <div key={coluna.status} className="flex w-[82vw] shrink-0 snap-center flex-col sm:w-auto sm:shrink">
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-sm font-semibold text-navy">
                          {prazo.obrigacoes_acessorias?.nome ?? '—'}
                        </p>
                        <p className="mt-1 text-sm text-charcoal">{prazo.clientes?.nome_empresa ?? '—'}</p>
                      </div>
                      <AcoesPrazo
                        id={prazo.id}
                        entidadeNome={`${prazo.obrigacoes_acessorias?.nome ?? 'Obrigação'} — ${prazo.clientes?.nome_empresa ?? 'Cliente'}`}
                        comprovanteUrl={prazo.comprovante_url}
                        onComprovanteAnexado={(comprovanteUrl, entregueEm) =>
                          comprovanteAnexado(prazo.id, comprovanteUrl, entregueEm)
                        }
                        onComprovanteRemovido={() => comprovanteRemovido(prazo.id)}
                      />
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-navy-soft">
                      Competência: {formatarCompetencia(prazo.competencia)}
                    </p>
                    <p className="font-mono text-[11px] text-navy-soft">
                      Vencimento: {formatarData(prazo.data_vencimento)}
                    </p>

                    {prazo.entregue_em && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <IconCheck className="h-3.5 w-3.5 shrink-0 text-success" />
                        <p className="text-[11px] text-success">Entregue em {formatarDataHora(prazo.entregue_em)}</p>
                        {prazo.comprovante_url && (
                          <button
                            type="button"
                            onClick={() => verComprovante(prazo.comprovante_url!)}
                            className="text-[11px] font-semibold text-success underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-success/80"
                          >
                            Ver comprovante
                          </button>
                        )}
                      </div>
                    )}

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

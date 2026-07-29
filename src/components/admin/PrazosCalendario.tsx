'use client'

import { useMemo, useState } from 'react'

type Prazo = {
  id: string
  competencia: string | null
  data_vencimento: string | null
  status: string
  clientes: { nome_empresa: string } | null
  obrigacoes_acessorias: { nome: string } | null
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const statusDot: Record<string, string> = {
  pendente: 'bg-navy-soft/50',
  atencao: 'bg-amber-500',
  em_dia: 'bg-[#4f8f2a]',
  vencido: 'bg-red-500',
}

const statusBadge: Record<string, string> = {
  pendente: 'bg-paper-dim text-navy-soft border border-rule',
  atencao: 'bg-amber-50 text-amber-700 border border-amber-200',
  em_dia: 'bg-[#eef7e0] text-[#4f8f2a] border border-[#c8e2a1]',
  vencido: 'bg-red-50 text-red-700 border border-red-200',
}

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  atencao: 'Atenção',
  em_dia: 'Em Dia',
  vencido: 'Vencido',
}

const MAX_VISIVEIS = 2

function chaveData(ano: number, mesIndex: number, dia: number) {
  return `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function formatarDataLonga(chave: string) {
  const [ano, mes, dia] = chave.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function PrazosCalendario({ prazos }: { prazos: Prazo[] }) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mesIndex, setMesIndex] = useState(hoje.getMonth())
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  const prazosPorDia = useMemo(() => {
    const mapa = new Map<string, Prazo[]>()
    for (const prazo of prazos) {
      if (!prazo.data_vencimento) continue
      const lista = mapa.get(prazo.data_vencimento) ?? []
      lista.push(prazo)
      mapa.set(prazo.data_vencimento, lista)
    }
    return mapa
  }, [prazos])

  const celulas = useMemo(() => {
    const primeiroDia = new Date(ano, mesIndex, 1)
    const ultimoDia = new Date(ano, mesIndex + 1, 0)
    const diasNoMes = ultimoDia.getDate()
    const diaSemanaInicio = primeiroDia.getDay()

    const lista: (number | null)[] = []
    for (let i = 0; i < diaSemanaInicio; i++) lista.push(null)
    for (let dia = 1; dia <= diasNoMes; dia++) lista.push(dia)

    return lista
  }, [ano, mesIndex])

  function irParaMesAnterior() {
    if (mesIndex === 0) {
      setMesIndex(11)
      setAno((a) => a - 1)
    } else {
      setMesIndex((m) => m - 1)
    }
  }

  function irParaProximoMes() {
    if (mesIndex === 11) {
      setMesIndex(0)
      setAno((a) => a + 1)
    } else {
      setMesIndex((m) => m + 1)
    }
  }

  function irParaMesAtual() {
    setAno(hoje.getFullYear())
    setMesIndex(hoje.getMonth())
  }

  const chaveHoje = chaveData(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const prazosDoDiaSelecionado = diaSelecionado ? prazosPorDia.get(diaSelecionado) ?? [] : []

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={irParaMesAnterior}
            aria-label="Mês anterior"
            className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-sm font-semibold text-navy-soft transition-colors duration-200 hover:text-navy"
          >
            ←
          </button>
          <h2 className="w-[130px] text-center font-display text-sm font-semibold text-navy sm:w-[170px] sm:text-base">
            {MESES[mesIndex]} {ano}
          </h2>
          <button
            type="button"
            onClick={irParaProximoMes}
            aria-label="Próximo mês"
            className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-sm font-semibold text-navy-soft transition-colors duration-200 hover:text-navy"
          >
            →
          </button>
        </div>

        <button
          type="button"
          onClick={irParaMesAtual}
          className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-xs font-semibold text-navy-soft transition-colors duration-200 hover:text-navy"
        >
          Hoje
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-rule bg-white">
        <div className="grid grid-cols-7 border-b border-rule bg-paper-dim">
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-[0.06em] text-navy-soft"
            >
              {dia}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {celulas.map((dia, index) => {
            if (dia === null) {
              return (
                <div
                  key={`vazio-${index}`}
                  className="min-h-[92px] border-b border-r border-rule bg-paper-dim/40"
                />
              )
            }

            const chave = chaveData(ano, mesIndex, dia)
            const prazosDoDia = prazosPorDia.get(chave) ?? []
            const visiveis = prazosDoDia.slice(0, MAX_VISIVEIS)
            const restantes = prazosDoDia.length - visiveis.length
            const ehHoje = chave === chaveHoje

            return (
              <button
                key={chave}
                type="button"
                onClick={() => prazosDoDia.length > 0 && setDiaSelecionado(chave)}
                disabled={prazosDoDia.length === 0}
                className={`flex min-h-[92px] flex-col items-stretch gap-1 border-b border-r border-rule p-1.5 text-left transition-colors duration-200 ${
                  prazosDoDia.length > 0 ? 'cursor-pointer hover:bg-paper-dim/60' : 'cursor-default'
                }`}
              >
                <span
                  className={
                    ehHoje
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-navy font-mono text-[11px] font-semibold text-white'
                      : 'font-mono text-[11px] text-navy-soft'
                  }
                >
                  {dia}
                </span>

                <div className="flex flex-col gap-0.5">
                  {visiveis.map((prazo) => (
                    <span key={prazo.id} className="flex items-center gap-1 truncate text-[10.5px] text-charcoal">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[prazo.status] ?? 'bg-navy-soft/50'}`}
                      />
                      <span className="truncate">{prazo.obrigacoes_acessorias?.nome ?? '—'}</span>
                    </span>
                  ))}
                  {restantes > 0 && (
                    <span className="text-[10.5px] font-semibold text-navy-soft">+{restantes}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {diaSelecionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4"
          onClick={() => setDiaSelecionado(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-rule bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-navy">
                Prazos em {formatarDataLonga(diaSelecionado)}
              </h3>
              <button
                type="button"
                onClick={() => setDiaSelecionado(null)}
                aria-label="Fechar"
                className="text-navy-soft transition-colors duration-200 hover:text-navy"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {prazosDoDiaSelecionado.map((prazo) => (
                <div key={prazo.id} className="rounded-md border border-rule p-3">
                  <p className="font-display text-sm font-semibold text-navy">
                    {prazo.obrigacoes_acessorias?.nome ?? '—'}
                  </p>
                  <p className="mt-1 text-sm text-charcoal">{prazo.clientes?.nome_empresa ?? '—'}</p>
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                      statusBadge[prazo.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                    }`}
                  >
                    {statusLabel[prazo.status] ?? prazo.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

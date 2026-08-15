'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
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
  solicitacao_documento: 'bg-lime/15 text-success border border-lime/40',
}

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  respondido: 'Respondido',
  concluido: 'Concluído',
}

const statusBadge: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700 border border-amber-200',
  respondido: 'bg-blue-50 text-blue-700 border border-blue-200',
  concluido: 'bg-success-bg text-success border border-success-border',
}

const PAGINA_TAMANHO = 25

const inputClasses =
  'rounded-[3px] border border-rule bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors duration-200 focus:border-lime'

type ColunaOrdenavel = 'cliente' | 'status' | 'created_at'
type Direcao = 'asc' | 'desc'
type Periodo = '' | 'hoje' | '7dias' | '30dias' | 'customizado'

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

// Formato YYYY-MM-DD no fuso de Brasília — comparável direto com o value de
// um <input type="date"> e entre si — mesma técnica já usada em
// CardComunicados.tsx pro filtro de data dos cards do Dashboard.
function dataLocalYMD(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

function somarDiasYMD(dataYMD: string, dias: number) {
  const [ano, mes, dia] = dataYMD.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

const comparadores: Record<ColunaOrdenavel, (a: Comunicado, b: Comunicado) => number> = {
  cliente: (a, b) => (a.clientes?.nome_empresa ?? '').localeCompare(b.clientes?.nome_empresa ?? '', 'pt-BR'),
  status: (a, b) => (statusLabel[a.status] ?? a.status).localeCompare(statusLabel[b.status] ?? b.status, 'pt-BR'),
  created_at: (a, b) => a.created_at.localeCompare(b.created_at),
}

function IconOrdenacao({ direcao }: { direcao: Direcao | null }) {
  if (!direcao) return <span className="inline-block w-3 opacity-30">↕</span>
  return <span className="inline-block w-3">{direcao === 'asc' ? '↑' : '↓'}</span>
}

function ThOrdenavel({
  coluna,
  label,
  ordenarPor,
  direcao,
  onClick,
}: {
  coluna: ColunaOrdenavel
  label: string
  ordenarPor: ColunaOrdenavel
  direcao: Direcao
  onClick: (coluna: ColunaOrdenavel) => void
}) {
  return (
    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
      <button
        type="button"
        onClick={() => onClick(coluna)}
        className="inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-navy"
      >
        {label}
        <IconOrdenacao direcao={ordenarPor === coluna ? direcao : null} />
      </button>
    </th>
  )
}

export default function ComunicadosTable({ comunicados }: { comunicados: Comunicado[] }) {
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const linhasRef = useRef<Record<string, HTMLTableRowElement | null>>({})

  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState<Periodo>('')
  const [dataInicioCustom, setDataInicioCustom] = useState('')
  const [dataFimCustom, setDataFimCustom] = useState('')

  const [ordenarPor, setOrdenarPor] = useState<ColunaOrdenavel>('created_at')
  const [direcao, setDirecao] = useState<Direcao>('desc')

  const [visivel, setVisivel] = useState(PAGINA_TAMANHO)

  useEffect(() => {
    // Lido do window.location (não useSearchParams) de propósito — mesma
    // técnica já usada em /login e /verificar-codigo: evita exigir Suspense
    // boundary só pra abrir direto numa conversa específica quando se chega
    // aqui pelo link "Ver conversa" dos cards de Comunicados do Dashboard.
    const params = new URLSearchParams(window.location.search)
    const idDestacado = params.get('comunicado')

    const indice = comunicados.findIndex((comunicado) => comunicado.id === idDestacado)
    if (indice === -1) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandidoId(idDestacado)
    // Garante que o comunicado alvo esteja dentro da janela "carregada" —
    // sem isso, se ele estiver além dos primeiros 25 (ordenação padrão),
    // a linha nem existiria no DOM ainda pro scrollIntoView funcionar.
    setVisivel((atual) => Math.max(atual, Math.ceil((indice + 1) / PAGINA_TAMANHO) * PAGINA_TAMANHO))
    linhasRef.current[idDestacado!]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const hojeYMD = dataLocalYMD(new Date().toISOString())

    const resultado = comunicados.filter((comunicado) => {
      if (
        termo &&
        !comunicado.titulo.toLowerCase().includes(termo) &&
        !(comunicado.clientes?.nome_empresa ?? '').toLowerCase().includes(termo)
      ) {
        return false
      }

      if (filtroTipo && comunicado.tipo !== filtroTipo) return false
      if (filtroStatus && comunicado.status !== filtroStatus) return false

      const dataComunicado = dataLocalYMD(comunicado.created_at)
      if (filtroPeriodo === 'hoje' && dataComunicado !== hojeYMD) return false
      if (filtroPeriodo === '7dias' && dataComunicado < somarDiasYMD(hojeYMD, -6)) return false
      if (filtroPeriodo === '30dias' && dataComunicado < somarDiasYMD(hojeYMD, -29)) return false
      if (filtroPeriodo === 'customizado') {
        if (dataInicioCustom && dataComunicado < dataInicioCustom) return false
        if (dataFimCustom && dataComunicado > dataFimCustom) return false
      }

      return true
    })

    resultado.sort((a, b) => comparadores[ordenarPor](a, b) * (direcao === 'asc' ? 1 : -1))
    return resultado
  }, [comunicados, busca, filtroTipo, filtroStatus, filtroPeriodo, dataInicioCustom, dataFimCustom, ordenarPor, direcao])

  // "Você pode não precisar de um Efeito" (react.dev): reseta a paginação
  // pra 1ª página quando os FILTROS mudam, calculado direto durante o
  // render (não num useEffect) — comparando com a chave da última vez que
  // rodou. Mudar só a ordenação não reseta (mesmo conjunto de itens).
  const filtroChave = `${busca}|${filtroTipo}|${filtroStatus}|${filtroPeriodo}|${dataInicioCustom}|${dataFimCustom}`
  const [ultimaFiltroChave, setUltimaFiltroChave] = useState(filtroChave)
  if (filtroChave !== ultimaFiltroChave) {
    setUltimaFiltroChave(filtroChave)
    setVisivel(PAGINA_TAMANHO)
  }

  const visiveis = filtrados.slice(0, visivel)
  const temFiltroAtivo = !!(busca || filtroTipo || filtroStatus || filtroPeriodo)

  function limparFiltros() {
    setBusca('')
    setFiltroTipo('')
    setFiltroStatus('')
    setFiltroPeriodo('')
    setDataInicioCustom('')
    setDataFimCustom('')
  }

  function alternarOrdenacao(coluna: ColunaOrdenavel) {
    if (ordenarPor === coluna) {
      setDirecao((atual) => (atual === 'asc' ? 'desc' : 'asc'))
    } else {
      setOrdenarPor(coluna)
      setDirecao('asc')
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          placeholder="Buscar por cliente ou título..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={`${inputClasses} w-full max-w-xs`}
        />

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className={inputClasses}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos os tipos</option>
          <option value="aviso">Aviso</option>
          <option value="solicitacao_documento">Solicitação de Documento</option>
        </select>

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className={inputClasses}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="respondido">Respondido</option>
          <option value="concluido">Concluído</option>
        </select>

        <select
          value={filtroPeriodo}
          onChange={(e) => setFiltroPeriodo(e.target.value as Periodo)}
          className={inputClasses}
          aria-label="Filtrar por período"
        >
          <option value="">Todo período</option>
          <option value="hoje">Hoje</option>
          <option value="7dias">Últimos 7 dias</option>
          <option value="30dias">Últimos 30 dias</option>
          <option value="customizado">Período customizado</option>
        </select>

        {filtroPeriodo === 'customizado' && (
          <>
            <input
              type="date"
              value={dataInicioCustom}
              onChange={(e) => setDataInicioCustom(e.target.value)}
              aria-label="Data inicial"
              className={`${inputClasses} w-[152px]`}
            />
            <span className="text-xs text-navy-soft">até</span>
            <input
              type="date"
              value={dataFimCustom}
              onChange={(e) => setDataFimCustom(e.target.value)}
              aria-label="Data final"
              className={`${inputClasses} w-[152px]`}
            />
          </>
        )}

        {temFiltroAtivo && (
          <button
            type="button"
            onClick={limparFiltros}
            className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
          >
            Limpar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-navy-soft">
          {filtrados.length} de {comunicados.length} comunicado(s)
        </span>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum comunicado encontrado com esses filtros.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-rule bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-paper-dim">
                  <tr>
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                      Título
                    </th>
                    <ThOrdenavel
                      coluna="cliente"
                      label="Cliente"
                      ordenarPor={ordenarPor}
                      direcao={direcao}
                      onClick={alternarOrdenacao}
                    />
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                      Tipo
                    </th>
                    <ThOrdenavel
                      coluna="status"
                      label="Status"
                      ordenarPor={ordenarPor}
                      direcao={direcao}
                      onClick={alternarOrdenacao}
                    />
                    <ThOrdenavel
                      coluna="created_at"
                      label="Enviado em"
                      ordenarPor={ordenarPor}
                      direcao={direcao}
                      onClick={alternarOrdenacao}
                    />
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((comunicado) => {
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
                                tipoComunicado={
                                  comunicado.tipo === 'solicitacao_documento' ? 'solicitacao_documento' : 'aviso'
                                }
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

          {visivel < filtrados.length && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisivel((atual) => atual + PAGINA_TAMANHO)}
                className="rounded-[3px] border-[1.3px] border-navy px-5 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper"
              >
                Carregar mais ({filtrados.length - visivel} restante{filtrados.length - visivel > 1 ? 's' : ''})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

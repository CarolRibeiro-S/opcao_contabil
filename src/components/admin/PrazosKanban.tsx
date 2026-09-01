'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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

const inputClasses =
  'rounded-[3px] border border-rule bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors duration-200 focus:border-lime'

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

function mesAtualPadrao() {
  const agora = new Date()
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 }
}

// ?mes=YYYY-MM na URL — dá pra compartilhar/voltar direto num mês
// específico. Formato inválido ou ausente cai no mês atual.
function parseMesParam(param: string | null): { ano: number; mes: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [anoStr, mesStr] = param.split('-')
    const mes = Number(mesStr)
    if (mes >= 1 && mes <= 12) return { ano: Number(anoStr), mes }
  }
  return mesAtualPadrao()
}

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

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Fonte única de verdade é a URL, não um useState local — assim
  // voltar/avançar no navegador entre meses já visitados funciona sem
  // precisar sincronizar manualmente.
  const { ano: anoFiltro, mes: mesFiltro } = parseMesParam(searchParams.get('mes'))
  const chaveMesFiltro = `${anoFiltro}-${String(mesFiltro).padStart(2, '0')}`

  function irParaMes(novoAno: number, novoMes: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', `${novoAno}-${String(novoMes).padStart(2, '0')}`)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function mesAnterior() {
    if (mesFiltro === 1) irParaMes(anoFiltro - 1, 12)
    else irParaMes(anoFiltro, mesFiltro - 1)
  }

  function mesSeguinte() {
    if (mesFiltro === 12) irParaMes(anoFiltro + 1, 1)
    else irParaMes(anoFiltro, mesFiltro + 1)
  }

  // Vencimento é a data que importa aqui, não a competência — prazo sem
  // data_vencimento nunca aparece em nenhum mês filtrado (mesmo caso raro
  // de regra sem tipo_vencimento reconhecido em gerarPrazos.ts).
  const prazosDoMes = useMemo(
    () => prazos.filter((prazo) => prazo.data_vencimento?.slice(0, 7) === chaveMesFiltro),
    [prazos, chaveMesFiltro]
  )

  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  // Lista de tipos vem do conjunto COMPLETO de prazos (não só do mês
  // filtrado) — assim o dropdown não muda de opções conforme se navega
  // entre meses, e qualquer obrigação nova cadastrada em regras_obrigacoes
  // aparece aqui sozinha, sem precisar fixar uma lista no código.
  const tiposDisponiveis = useMemo(() => {
    const nomes = new Set<string>()
    for (const prazo of prazos) {
      if (prazo.obrigacoes_acessorias?.nome) nomes.add(prazo.obrigacoes_acessorias.nome)
    }
    return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [prazos])

  const prazosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return prazosDoMes
      .filter((prazo) => !termo || (prazo.clientes?.nome_empresa ?? '').toLowerCase().includes(termo))
      .filter((prazo) => !filtroTipo || prazo.obrigacoes_acessorias?.nome === filtroTipo)
  }, [prazosDoMes, busca, filtroTipo])

  const temFiltroTextoOuTipo = !!(busca || filtroTipo)

  function limparFiltrosTextoETipo() {
    setBusca('')
    setFiltroTipo('')
  }

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [processandoLote, setProcessandoLote] = useState(false)

  // "Você pode não precisar de um Efeito" (react.dev): limpa a seleção
  // quando mês, busca ou tipo mudam, calculado direto durante o render —
  // mesmo padrão já usado em CobrancasTable.tsx pra não deixar seleção
  // "presa" em cards que saíram de vista.
  const filtroChave = `${chaveMesFiltro}|${busca}|${filtroTipo}`
  const [ultimoFiltroChave, setUltimoFiltroChave] = useState(filtroChave)
  if (filtroChave !== ultimoFiltroChave) {
    setUltimoFiltroChave(filtroChave)
    if (selecionados.size > 0) setSelecionados(new Set())
  }

  function alternarUm(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  // Seleção "todos" é por COLUNA (status), não global — faz mais sentido
  // limpar um backlog de uma coluna de cada vez do que misturar Pendente
  // com Vencido numa selecionada só.
  function alternarTodosColuna(prazosDaColuna: Prazo[]) {
    const todosSelecionados = prazosDaColuna.length > 0 && prazosDaColuna.every((prazo) => selecionados.has(prazo.id))
    setSelecionados((atual) => {
      const novo = new Set(atual)
      for (const prazo of prazosDaColuna) {
        if (todosSelecionados) novo.delete(prazo.id)
        else novo.add(prazo.id)
      }
      return novo
    })
  }

  const selecionadosArray = useMemo(() => prazos.filter((prazo) => selecionados.has(prazo.id)), [prazos, selecionados])

  async function marcarSelecionadosComoEntregue() {
    if (selecionadosArray.length === 0) return

    const confirmado = window.confirm(
      `Marcar ${selecionadosArray.length} prazo${selecionadosArray.length > 1 ? 's' : ''} como entregue${selecionadosArray.length > 1 ? 's' : ''}, sem comprovante anexado?`
    )
    if (!confirmado) return

    setProcessandoLote(true)
    const entregueEm = new Date().toISOString()

    // Sequencial, não em lote concorrente — mesmo motivo já documentado em
    // CobrancasTable.tsx: ação client-side sem limite de tempo de function
    // serverless, e o volume aqui é sempre a seleção manual numa tela, não
    // um processamento em massa por si só.
    for (const prazo of selecionadosArray) {
      const statusAnterior = prazo.status

      setPrazos((atual) =>
        atual.map((p) => (p.id === prazo.id ? { ...p, entregue_em: entregueEm, status: 'em_dia' } : p))
      )

      const { error } = await supabase
        .from('prazos')
        .update({ entregue_em: entregueEm, status: 'em_dia' })
        .eq('id', prazo.id)

      if (error) {
        setPrazos((atual) =>
          atual.map((p) =>
            p.id === prazo.id ? { ...p, entregue_em: prazo.entregue_em, status: statusAnterior } : p
          )
        )
        continue
      }

      const tituloAnterior = COLUNAS.find((coluna) => coluna.status === statusAnterior)?.titulo ?? statusAnterior

      registrarHistoricoAtividade({
        acao: 'moveu_prazo',
        entidade: 'prazo',
        entidadeId: prazo.id,
        entidadeNome: `${prazo.obrigacoes_acessorias?.nome ?? 'Obrigação'} — ${prazo.clientes?.nome_empresa ?? 'Cliente'}`,
        detalhes: `Marcado como entregue em lote (sem comprovante) — ${tituloAnterior} → Em Dia`,
      })
    }

    setProcessandoLote(false)
    setSelecionados(new Set())
  }

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
    <div>
      <div className="mb-5 flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={mesAnterior}
          aria-label="Mês anterior"
          className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-sm font-semibold text-navy-soft transition-colors duration-200 hover:text-navy"
        >
          ←
        </button>
        <h2 className="w-[170px] text-center font-display text-sm font-semibold text-navy sm:text-base">
          {MESES[mesFiltro - 1]} {anoFiltro}
        </h2>
        <button
          type="button"
          onClick={mesSeguinte}
          aria-label="Próximo mês"
          className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-sm font-semibold text-navy-soft transition-colors duration-200 hover:text-navy"
        >
          →
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          placeholder="Buscar por cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={`${inputClasses} w-full max-w-xs`}
        />

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className={inputClasses}
          aria-label="Filtrar por tipo de obrigação"
        >
          <option value="">Todos os tipos</option>
          {tiposDisponiveis.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>

        {temFiltroTextoOuTipo && (
          <button
            type="button"
            onClick={limparFiltrosTextoETipo}
            className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
          >
            Limpar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-navy-soft">
          {prazosFiltrados.length} de {prazosDoMes.length} prazo(s) do mês
        </span>
      </div>

      {selecionados.size > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lime/50 bg-lime/10 px-4 py-3">
          <p className="text-sm font-medium text-navy">{selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSelecionados(new Set())}
              className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
            >
              Limpar seleção
            </button>
            <button
              type="button"
              onClick={marcarSelecionadosComoEntregue}
              disabled={processandoLote}
              className="rounded-[3px] bg-lime px-4 py-1.5 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processandoLote ? 'Marcando...' : `Marcar ${selecionados.size} como entregue${selecionados.size > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {COLUNAS.map((coluna, colunaIndex) => {
          const prazosDaColuna = prazosFiltrados.filter((prazo) => prazo.status === coluna.status)
          const todosColunaSelecionados =
            prazosDaColuna.length > 0 && prazosDaColuna.every((prazo) => selecionados.has(prazo.id))
          const algunsColunaSelecionados = prazosDaColuna.some((prazo) => selecionados.has(prazo.id))

          return (
            <div key={coluna.status} className="flex w-[82vw] shrink-0 snap-center flex-col sm:w-auto sm:shrink">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    ref={(el) => {
                      if (el) el.indeterminate = algunsColunaSelecionados && !todosColunaSelecionados
                    }}
                    checked={todosColunaSelecionados}
                    onChange={() => alternarTodosColuna(prazosDaColuna)}
                    disabled={prazosDaColuna.length === 0}
                    aria-label={`Selecionar todos os prazos de ${coluna.titulo}`}
                    className="h-3.5 w-3.5 accent-lime disabled:opacity-30"
                  />
                  <h2 className="font-display text-sm font-semibold text-navy">{coluna.titulo}</h2>
                </div>
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
                      className={`rounded-lg border border-t-rule border-r-rule border-b-rule border-l-4 ${coluna.corBorda} p-4 shadow-sm ${
                        selecionados.has(prazo.id) ? 'bg-lime/5' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selecionados.has(prazo.id)}
                            onChange={() => alternarUm(prazo.id)}
                            aria-label={`Selecionar ${prazo.obrigacoes_acessorias?.nome ?? 'prazo'} — ${prazo.clientes?.nome_empresa ?? 'cliente'}`}
                            className="mt-1 h-3.5 w-3.5 shrink-0 accent-lime"
                          />
                          <div className="min-w-0">
                            <p className="font-display text-sm font-semibold text-navy">
                              {prazo.obrigacoes_acessorias?.nome ?? '—'}
                            </p>
                            <p className="mt-1 text-sm text-charcoal">{prazo.clientes?.nome_empresa ?? '—'}</p>
                          </div>
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

                      {prazo.entregue_em && prazo.comprovante_url && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <IconCheck className="h-3.5 w-3.5 shrink-0 text-success" />
                          <p className="text-[11px] text-success">Entregue em {formatarDataHora(prazo.entregue_em)}</p>
                          <button
                            type="button"
                            onClick={() => verComprovante(prazo.comprovante_url!)}
                            className="text-[11px] font-semibold text-success underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-success/80"
                          >
                            Ver comprovante
                          </button>
                        </div>
                      )}

                      {/* Marcado em lote (sem arquivo) — indicador visualmente
                          diferente do check verde acima, pra ficar claro que
                          ninguém anexou comprovante de verdade pra esse
                          prazo. */}
                      {prazo.entregue_em && !prazo.comprovante_url && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-navy-soft/40" />
                          <p className="text-[11px] text-navy-soft">
                            Marcado como entregue em {formatarDataHora(prazo.entregue_em)} (sem comprovante)
                          </p>
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
    </div>
  )
}

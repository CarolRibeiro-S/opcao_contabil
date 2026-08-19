'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { marcarHonorarioComoPago } from '@/lib/receitaHonorario'
import MarcarComoPago from './MarcarComoPago'
import ReenviarEmailCobranca from './ReenviarEmailCobranca'

export type FalhaEntrega = { tipo: string; detalhe: string | null; criadoEm: string }

type Cobranca = {
  id: string
  competencia: string | null
  valor: number | null
  status: string
  data_vencimento: string | null
  descricao: string | null
  boleto_caminho_arquivo: string | null
  enviado_email_em: string | null
  falhaEntrega: FalhaEntrega | null
  clientes: { nome_empresa: string } | null
}

const TIPO_FALHA_LABEL: Record<string, string> = {
  bounced: 'Bounce',
  failed: 'Falha no despacho',
  delivery_delayed: 'Entrega atrasada',
  complained: 'Marcado como spam',
}

const statusLabel: Record<string, string> = {
  em_aberto: 'Em Aberto',
  pago: 'Pago',
  atrasado: 'Atrasado',
}

function formatarData(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarDataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function formatarCompetencia(data: string | null) {
  if (!data) return '—'
  const [ano, mes] = data.split('-')
  return `${mes}/${ano}`
}

function formatarValor(valor: number | null) {
  if (valor === null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CORES_PONTO: Record<'verde' | 'ambar' | 'vermelho' | 'cinza', string> = {
  verde: 'bg-success',
  ambar: 'bg-amber-500',
  vermelho: 'bg-red-500',
  cinza: 'bg-navy-soft/40',
}

// Indicador compacto (ponto colorido + texto curto) — substitui os badges
// grandes de antes. A cor sozinha já dá a leitura rápida (verde=ok,
// âmbar=precisa de ação, vermelho=problema, cinza=ainda não começou);
// o texto é só confirmação, e o title (tooltip) carrega qualquer detalhe
// mais longo sem quebrar a linha.
function Indicador({
  cor,
  texto,
  titulo,
}: {
  cor: 'verde' | 'ambar' | 'vermelho' | 'cinza'
  texto: string
  titulo?: string
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={titulo}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${CORES_PONTO[cor]}`} />
      <span className="truncate text-xs text-charcoal">{texto}</span>
    </span>
  )
}

function corStatusPagamento(status: string): 'verde' | 'ambar' | 'vermelho' {
  if (status === 'pago') return 'verde'
  if (status === 'atrasado') return 'vermelho'
  return 'ambar'
}

// As duas colunas de antes (Status + Boleto/E-mail, cada uma com badge(s)
// grandes empilhados) viram uma única coluna "Situação" com dois
// indicadores compactos lado a lado — cabe numa linha só na maioria dos
// casos, e as duas dimensões (pagamento e entrega) continuam distintas,
// só mais leves visualmente.
function Situacao({ cobranca }: { cobranca: Cobranca }) {
  const corPagamento = corStatusPagamento(cobranca.status)
  const textoPagamento = statusLabel[cobranca.status] ?? cobranca.status

  let corEntrega: 'verde' | 'ambar' | 'vermelho' | 'cinza'
  let textoEntrega: string
  let tituloEntrega: string | undefined

  if (cobranca.falhaEntrega) {
    corEntrega = 'vermelho'
    textoEntrega = 'Não entregue'
    const rotulo = TIPO_FALHA_LABEL[cobranca.falhaEntrega.tipo] ?? cobranca.falhaEntrega.tipo
    tituloEntrega = cobranca.falhaEntrega.detalhe ? `${rotulo} — ${cobranca.falhaEntrega.detalhe}` : rotulo
  } else if (!cobranca.boleto_caminho_arquivo) {
    corEntrega = 'cinza'
    textoEntrega = 'Sem boleto'
  } else if (!cobranca.enviado_email_em) {
    corEntrega = 'ambar'
    textoEntrega = 'E-mail pendente'
  } else {
    corEntrega = 'verde'
    textoEntrega = 'Enviado'
    tituloEntrega = `Enviado em ${formatarDataCurta(cobranca.enviado_email_em)}`
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Indicador cor={corPagamento} texto={textoPagamento} />
      <Indicador cor={corEntrega} texto={textoEntrega} titulo={tituloEntrega} />
    </div>
  )
}

export default function CobrancasTable({ cobrancas }: { cobrancas: Cobranca[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [somenteAguardandoBoleto, setSomenteAguardandoBoleto] = useState(false)
  const [somenteNaoEntregues, setSomenteNaoEntregues] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [processandoLote, setProcessandoLote] = useState(false)

  const visiveis = useMemo(
    () =>
      cobrancas
        .filter((cobranca) => !somenteAguardandoBoleto || !cobranca.boleto_caminho_arquivo)
        .filter((cobranca) => !somenteNaoEntregues || !!cobranca.falhaEntrega),
    [cobrancas, somenteAguardandoBoleto, somenteNaoEntregues]
  )

  const totalAguardando = useMemo(() => cobrancas.filter((cobranca) => !cobranca.boleto_caminho_arquivo).length, [cobrancas])
  const totalNaoEntregues = useMemo(() => cobrancas.filter((cobranca) => !!cobranca.falhaEntrega).length, [cobrancas])

  // "Você pode não precisar de um Efeito" (react.dev): limpa a seleção
  // quando os FILTROS mudam, calculado direto durante o render — evita
  // marcar em lote sobre linhas que ficaram escondidas sem o admin notar
  // (mesmo padrão já usado em ComunicadosTable.tsx pra resetar paginação).
  const filtroChave = `${somenteAguardandoBoleto}|${somenteNaoEntregues}`
  const [ultimaFiltroChave, setUltimaFiltroChave] = useState(filtroChave)
  if (filtroChave !== ultimaFiltroChave) {
    setUltimaFiltroChave(filtroChave)
    if (selecionados.size > 0) setSelecionados(new Set())
  }

  const todosVisiveisSelecionados = visiveis.length > 0 && visiveis.every((cobranca) => selecionados.has(cobranca.id))
  const algunsVisiveisSelecionados = visiveis.some((cobranca) => selecionados.has(cobranca.id))
  const indeterminado = algunsVisiveisSelecionados && !todosVisiveisSelecionados

  const selecionadosPendentes = cobrancas.filter((cobranca) => selecionados.has(cobranca.id) && cobranca.status !== 'pago')

  function alternarTodos() {
    if (todosVisiveisSelecionados) {
      setSelecionados(new Set())
    } else {
      // Respeita o filtro ativo — só seleciona o que está visível na tela
      // agora, não a lista inteira de honorários.
      setSelecionados(new Set(visiveis.map((cobranca) => cobranca.id)))
    }
  }

  function alternarUm(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  async function marcarSelecionadosComoPago() {
    if (selecionadosPendentes.length === 0) return

    const confirmado = window.confirm(
      `Marcar ${selecionadosPendentes.length} honorário${selecionadosPendentes.length > 1 ? 's' : ''} como pago?`
    )
    if (!confirmado) return

    setProcessandoLote(true)

    // Sequencial, não em lotes concorrentes — é uma ação client-side (sem
    // limite de tempo de function serverless) e o volume aqui é sempre
    // pequeno (a seleção manual numa tabela), então a simplicidade vale
    // mais que a otimização de velocidade.
    for (const cobranca of selecionadosPendentes) {
      await marcarHonorarioComoPago(
        supabase,
        cobranca.id,
        `${cobranca.clientes?.nome_empresa ?? 'Cliente'} — ${formatarCompetencia(cobranca.competencia)}`
      )
    }

    setProcessandoLote(false)
    setSelecionados(new Set())
    router.refresh()
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setSomenteAguardandoBoleto((atual) => !atual)}
          className={`rounded-[3px] border-[1.3px] px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
            somenteAguardandoBoleto
              ? 'border-lime bg-lime/15 text-navy'
              : 'border-rule bg-white text-navy-soft hover:border-navy'
          }`}
        >
          Só aguardando boleto {totalAguardando > 0 && `(${totalAguardando})`}
        </button>

        <button
          type="button"
          onClick={() => setSomenteNaoEntregues((atual) => !atual)}
          className={`rounded-[3px] border-[1.3px] px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
            somenteNaoEntregues
              ? 'border-red-400 bg-red-50 text-red-700'
              : 'border-rule bg-white text-navy-soft hover:border-navy'
          }`}
        >
          Só não entregues {totalNaoEntregues > 0 && `(${totalNaoEntregues})`}
        </button>
      </div>

      <p className="mb-5 text-xs text-navy-soft/80">
        &quot;Enviado&quot; significa apenas que não há falha de entrega conhecida até agora — a Resend só avisa
        sobre falhas (bounce, spam, atraso), não confirma que a mensagem chegou de verdade na caixa de entrada.
      </p>

      {selecionados.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lime/50 bg-lime/10 px-4 py-3">
          <p className="text-sm font-medium text-navy">
            {selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}
            {selecionadosPendentes.length !== selecionados.size &&
              ` (${selecionadosPendentes.length} ainda não pago${selecionadosPendentes.length !== 1 ? 's' : ''})`}
          </p>
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
              onClick={marcarSelecionadosComoPago}
              disabled={selecionadosPendentes.length === 0 || processandoLote}
              className="rounded-[3px] bg-lime px-4 py-1.5 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processandoLote
                ? 'Marcando...'
                : selecionadosPendentes.length > 0
                  ? `Marcar ${selecionadosPendentes.length} como pago`
                  : 'Já estão todos pagos'}
            </button>
          </div>
        </div>
      )}

      {visiveis.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum honorário encontrado com esse filtro.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-paper-dim">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      ref={(el) => {
                        if (el) el.indeterminate = indeterminado
                      }}
                      type="checkbox"
                      checked={todosVisiveisSelecionados}
                      onChange={alternarTodos}
                      aria-label="Selecionar todos os honorários visíveis"
                      className="h-4 w-4 accent-lime"
                    />
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Cliente
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Competência
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Valor
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Vencimento
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Situação
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((cobranca) => (
                  <tr
                    key={cobranca.id}
                    className={`border-t border-rule ${selecionados.has(cobranca.id) ? 'bg-lime/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selecionados.has(cobranca.id)}
                        onChange={() => alternarUm(cobranca.id)}
                        aria-label={`Selecionar ${cobranca.clientes?.nome_empresa ?? 'cliente'}`}
                        className="h-4 w-4 accent-lime"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{cobranca.clientes?.nome_empresa ?? '—'}</p>
                      {cobranca.descricao && (
                        <p className="mt-0.5 text-xs text-navy-soft/70">{cobranca.descricao}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-charcoal">{formatarCompetencia(cobranca.competencia)}</td>
                    <td className="px-4 py-3 text-charcoal">{formatarValor(cobranca.valor)}</td>
                    <td className="px-4 py-3 text-charcoal">{formatarData(cobranca.data_vencimento)}</td>
                    <td className="px-4 py-3">
                      <Situacao cobranca={cobranca} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/cobrancas/${cobranca.id}/editar`}
                          className="text-xs font-semibold text-navy-soft transition-colors duration-200 hover:text-navy"
                        >
                          Editar
                        </Link>
                        {cobranca.boleto_caminho_arquivo && <ReenviarEmailCobranca id={cobranca.id} />}
                        <MarcarComoPago
                          id={cobranca.id}
                          status={cobranca.status}
                          entidadeNome={`${cobranca.clientes?.nome_empresa ?? 'Cliente'} — ${formatarCompetencia(cobranca.competencia)}`}
                        />
                      </div>
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

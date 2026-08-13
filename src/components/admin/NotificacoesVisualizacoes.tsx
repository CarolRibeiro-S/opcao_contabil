import { createClient } from '@/lib/supabase/server'
import VisualizacoesRecentesBanner, { type ItemVisualizacaoRecente } from './VisualizacoesRecentesBanner'
import { TIPO_ENVIO_LABEL, type TipoEnvioSolicitacaoMensal } from '@/lib/solicitacaoMensal'

const JANELA_HORAS = 24
const LIMITE_POR_FONTE = 10

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

function formatarCompetenciaCurta(competencia: string | null) {
  if (!competencia) return '—'
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano}`
}

type ItemComQuando = ItemVisualizacaoRecente & { quando: string }

type CobrancaRow = {
  id: string
  competencia: string | null
  visualizado_pelo_cliente_em: string
  clientes: { nome_empresa: string } | null
}

type ComunicadoRow = {
  id: string
  titulo: string
  visualizado_pelo_cliente_em: string
  clientes: { nome_empresa: string } | null
}

type DocumentoRow = {
  id: string
  cliente_id: string
  visualizado_pelo_cliente_em: string
  clientes: { nome_empresa: string } | null
}

type EnvioSolicitacaoRow = {
  id: string
  cliente_id: string
  competencia: string
  tipo: TipoEnvioSolicitacaoMensal
  visualizado_pelo_cliente_em: string
  clientes: { nome_empresa: string } | null
}

// Documentos e solicitações mensais são marcados EM LOTE (MarcarVisualizado
// marca tudo que tava null de uma vez, com o mesmo timestamp exato pra
// todas as linhas do lote) — sem agrupar, uma visita do cliente à página de
// Documentos com 8 arquivos novos viraria 8 linhas idênticas no banner. Usa
// cliente_id + timestamp exato como chave: junta tudo que foi marcado no
// mesmo lote numa única linha "visualizou N item(ns)".
function agruparPorClienteEQuando<T extends { cliente_id: string; visualizado_pelo_cliente_em: string; clientes: { nome_empresa: string } | null }>(
  linhas: T[]
) {
  const grupos = new Map<string, { nomeCliente: string; quando: string; quantidade: number }>()

  for (const linha of linhas) {
    const chave = `${linha.cliente_id}|${linha.visualizado_pelo_cliente_em}`
    const atual = grupos.get(chave)
    if (atual) {
      atual.quantidade += 1
    } else {
      grupos.set(chave, {
        nomeCliente: linha.clientes?.nome_empresa ?? 'Cliente',
        quando: linha.visualizado_pelo_cliente_em,
        quantidade: 1,
      })
    }
  }

  return Array.from(grupos.entries()).map(([chave, grupo]) => ({ id: chave, ...grupo }))
}

// Mesma lógica de agrupamento acima, mas guarda também o tipo (principal,
// reforço, aviso extra) — só pra decidir o texto singular ("a solicitação
// mensal (Reforço)") quando o lote marcado de uma vez tinha um único tipo.
function agruparSolicitacoes(linhas: EnvioSolicitacaoRow[]) {
  const grupos = new Map<
    string,
    { nomeCliente: string; quando: string; quantidade: number; tipos: Set<TipoEnvioSolicitacaoMensal> }
  >()

  for (const linha of linhas) {
    const chave = `${linha.cliente_id}|${linha.visualizado_pelo_cliente_em}`
    const atual = grupos.get(chave)
    if (atual) {
      atual.quantidade += 1
      atual.tipos.add(linha.tipo)
    } else {
      grupos.set(chave, {
        nomeCliente: linha.clientes?.nome_empresa ?? 'Cliente',
        quando: linha.visualizado_pelo_cliente_em,
        quantidade: 1,
        tipos: new Set([linha.tipo]),
      })
    }
  }

  return Array.from(grupos.entries()).map(([chave, grupo]) => ({
    id: chave,
    nomeCliente: grupo.nomeCliente,
    quando: grupo.quando,
    quantidade: grupo.quantidade,
    tipoUnico: grupo.tipos.size === 1 ? [...grupo.tipos][0] : null,
  }))
}

export default async function NotificacoesVisualizacoes() {
  const supabase = await createClient()

  const agora = new Date()
  const desde = new Date(agora.getTime() - JANELA_HORAS * 60 * 60 * 1000).toISOString()

  const [cobrancasRes, comunicadosRes, documentosRes, solicitacoesRes] = await Promise.all([
    supabase
      .from('cobrancas')
      .select('id, competencia, visualizado_pelo_cliente_em, clientes(nome_empresa)')
      .not('visualizado_pelo_cliente_em', 'is', null)
      .gte('visualizado_pelo_cliente_em', desde)
      .order('visualizado_pelo_cliente_em', { ascending: false })
      .limit(LIMITE_POR_FONTE)
      .returns<CobrancaRow[]>(),
    supabase
      .from('comunicados')
      .select('id, titulo, visualizado_pelo_cliente_em, clientes(nome_empresa)')
      .not('visualizado_pelo_cliente_em', 'is', null)
      .gte('visualizado_pelo_cliente_em', desde)
      .order('visualizado_pelo_cliente_em', { ascending: false })
      .limit(LIMITE_POR_FONTE)
      .returns<ComunicadoRow[]>(),
    supabase
      .from('documentos_clientes')
      .select('id, cliente_id, visualizado_pelo_cliente_em, clientes(nome_empresa)')
      .not('visualizado_pelo_cliente_em', 'is', null)
      .gte('visualizado_pelo_cliente_em', desde)
      .order('visualizado_pelo_cliente_em', { ascending: false })
      .limit(50)
      .returns<DocumentoRow[]>(),
    supabase
      .from('envios_solicitacao_mensal')
      .select('id, cliente_id, competencia, tipo, visualizado_pelo_cliente_em, clientes(nome_empresa)')
      .not('visualizado_pelo_cliente_em', 'is', null)
      .gte('visualizado_pelo_cliente_em', desde)
      .order('visualizado_pelo_cliente_em', { ascending: false })
      .limit(50)
      .returns<EnvioSolicitacaoRow[]>(),
  ])

  const itensCobrancas: ItemComQuando[] = (cobrancasRes.data ?? []).map((cobranca) => ({
    id: `cobranca-${cobranca.id}`,
    quando: cobranca.visualizado_pelo_cliente_em,
    texto: (
      <>
        <strong>{cobranca.clientes?.nome_empresa ?? 'Cliente'}</strong> visualizou o honorário de{' '}
        <strong>{formatarCompetenciaCurta(cobranca.competencia)}</strong> em{' '}
        {formatarDataHora(cobranca.visualizado_pelo_cliente_em)}
      </>
    ),
  }))

  const itensComunicados: ItemComQuando[] = (comunicadosRes.data ?? []).map((comunicado) => ({
    id: `comunicado-${comunicado.id}`,
    quando: comunicado.visualizado_pelo_cliente_em,
    texto: (
      <>
        <strong>{comunicado.clientes?.nome_empresa ?? 'Cliente'}</strong> visualizou o comunicado{' '}
        <strong>&quot;{comunicado.titulo}&quot;</strong> em {formatarDataHora(comunicado.visualizado_pelo_cliente_em)}
      </>
    ),
  }))

  const itensDocumentos: ItemComQuando[] = agruparPorClienteEQuando(documentosRes.data ?? []).map((grupo) => ({
    id: `documento-${grupo.id}`,
    quando: grupo.quando,
    texto: (
      <>
        <strong>{grupo.nomeCliente}</strong> visualizou{' '}
        <strong>
          {grupo.quantidade} documento{grupo.quantidade > 1 ? 's' : ''}
        </strong>{' '}
        em {formatarDataHora(grupo.quando)}
      </>
    ),
  }))

  const itensSolicitacoes: ItemComQuando[] = agruparSolicitacoes(solicitacoesRes.data ?? []).map((grupo) => {
    const descricao =
      grupo.quantidade === 1 && grupo.tipoUnico
        ? `a solicitação mensal (${TIPO_ENVIO_LABEL[grupo.tipoUnico]})`
        : `${grupo.quantidade} solicitações mensais`

    return {
      id: `solicitacao-${grupo.id}`,
      quando: grupo.quando,
      texto: (
        <>
          <strong>{grupo.nomeCliente}</strong> visualizou <strong>{descricao}</strong> em{' '}
          {formatarDataHora(grupo.quando)}
        </>
      ),
    }
  })

  const todosItens = [...itensCobrancas, ...itensComunicados, ...itensDocumentos, ...itensSolicitacoes].sort(
    (a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime()
  )

  if (todosItens.length === 0) return null

  return <VisualizacoesRecentesBanner itens={todosItens} />
}

import { createClient } from '@/lib/supabase/server'
import VisualizacoesHonorariosBanner from './VisualizacoesHonorariosBanner'

type VisualizacaoResumo = {
  id: string
  competencia: string | null
  clientes: { nome_empresa: string } | null
}

function formatarCompetenciaCurta(competencia: string | null) {
  if (!competencia) return '—'
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano}`
}

// Diferente de NotificacoesRespostas.tsx (comunicados): não existe um campo
// "visto pelo admin" pra honorários, então em vez de "visto_em IS NULL" só
// mostramos as visualizações das últimas 24h — o botão "x" no componente
// cliente (VisualizacoesHonorariosBanner) cobre o "descartar", sem precisar
// replicar toda a lógica de visto/não-visto usada em comunicados.
export default async function NotificacoesVisualizacoesHonorarios() {
  const supabase = await createClient()

  const agora = new Date()
  const desde = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const { data: visualizacoes } = await supabase
    .from('cobrancas')
    .select('id, competencia, clientes(nome_empresa)')
    .not('visualizado_pelo_cliente_em', 'is', null)
    .gte('visualizado_pelo_cliente_em', desde)
    .order('visualizado_pelo_cliente_em', { ascending: false })
    .limit(10)
    .returns<VisualizacaoResumo[]>()

  const lista = visualizacoes ?? []

  if (lista.length === 0) return null

  const itens = lista.map((cobranca) => ({
    id: cobranca.id,
    nomeCliente: cobranca.clientes?.nome_empresa ?? 'Cliente',
    competencia: formatarCompetenciaCurta(cobranca.competencia),
  }))

  return <VisualizacoesHonorariosBanner itens={itens} />
}

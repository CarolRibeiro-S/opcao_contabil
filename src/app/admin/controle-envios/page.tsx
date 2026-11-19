import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ControleEnviosTabela, { type FalhaEntregaEnvio, type ItemEnvio } from '@/components/admin/ControleEnviosTabela'
import { TIPO_ENVIO_LABEL, type TipoEnvioSolicitacaoMensal } from '@/lib/solicitacaoMensal'

const LIMITE_POR_FONTE = 200

type ComunicadoRow = {
  id: string
  titulo: string
  cliente_id: string
  created_at: string
  visualizado_pelo_cliente_em: string | null
  resend_email_id: string | null
  clientes: { nome_empresa: string } | null
}

type DocumentoRow = {
  id: string
  nome_arquivo: string
  cliente_id: string
  enviado_em: string | null
  visualizado_pelo_cliente_em: string | null
  resend_email_id: string | null
  clientes: { nome_empresa: string } | null
}

type EnvioSolicitacaoRow = {
  id: string
  cliente_id: string
  competencia: string
  tipo: TipoEnvioSolicitacaoMensal
  enviado_em: string
  visualizado_pelo_cliente_em: string | null
  resend_email_id: string | null
  clientes: { nome_empresa: string } | null
}

type EventoRow = { resend_email_id: string; tipo: string; detalhe: string | null; criado_em: string }

// Mesmo padrão já usado em admin/cobrancas/page.tsx: email_eventos tem RLS
// sem nenhuma policy (só a service role alcança), e "mais recente vence"
// se um resend_email_id tiver mais de um evento — a query já vem ordenada
// por criado_em crescente, então o Map fica só com o último.
async function buscarEventosFalha(resendEmailIds: string[]): Promise<Map<string, FalhaEntregaEnvio>> {
  if (resendEmailIds.length === 0) return new Map()

  const supabaseAdmin = createAdminClient()

  const { data, error } = await supabaseAdmin
    .from('email_eventos')
    .select('resend_email_id, tipo, detalhe, criado_em')
    .in('resend_email_id', resendEmailIds)
    .order('criado_em', { ascending: true })
    .returns<EventoRow[]>()

  if (error) {
    console.error('[admin/controle-envios] Erro ao buscar email_eventos:', error)
    return new Map()
  }

  const mapa = new Map<string, FalhaEntregaEnvio>()
  for (const evento of data ?? []) {
    mapa.set(evento.resend_email_id, { tipo: evento.tipo, detalhe: evento.detalhe, criadoEm: evento.criado_em })
  }
  return mapa
}

function formatarCompetenciaCurta(competencia: string) {
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano}`
}

// Lista tudo que foi enviado a clientes recentemente (comunicados,
// documentos, solicitações mensais — honorários fica de fora aqui de
// propósito, já tem sua própria tela em /admin/cobrancas) com status de
// visualização. Cada fonte é limitada a LIMITE_POR_FONTE linhas mais
// recentes — página simples, sem paginação por enquanto; se o volume
// crescer muito isso pode precisar de paginação de verdade.
export default async function ControleEnviosPage() {
  const supabase = await createClient()

  const [comunicadosRes, documentosRes, solicitacoesRes] = await Promise.all([
    supabase
      .from('comunicados')
      .select('id, titulo, cliente_id, created_at, visualizado_pelo_cliente_em, resend_email_id, clientes(nome_empresa)')
      .order('created_at', { ascending: false })
      .limit(LIMITE_POR_FONTE)
      .returns<ComunicadoRow[]>(),
    supabase
      .from('documentos_clientes')
      .select('id, nome_arquivo, cliente_id, enviado_em, visualizado_pelo_cliente_em, resend_email_id, clientes(nome_empresa)')
      .order('enviado_em', { ascending: false })
      .limit(LIMITE_POR_FONTE)
      .returns<DocumentoRow[]>(),
    supabase
      .from('envios_solicitacao_mensal')
      .select(
        'id, cliente_id, competencia, tipo, enviado_em, visualizado_pelo_cliente_em, resend_email_id, clientes(nome_empresa)'
      )
      .order('enviado_em', { ascending: false })
      .limit(LIMITE_POR_FONTE)
      .returns<EnvioSolicitacaoRow[]>(),
  ])

  const idsComEmail = [
    ...(comunicadosRes.data ?? []).map((item) => item.resend_email_id),
    ...(documentosRes.data ?? []).map((item) => item.resend_email_id),
    ...(solicitacoesRes.data ?? []).map((item) => item.resend_email_id),
  ].filter((id): id is string => !!id)

  const eventosFalha = await buscarEventosFalha(idsComEmail)

  const itensComunicados: ItemEnvio[] = (comunicadosRes.data ?? []).map((comunicado) => ({
    id: `comunicado-${comunicado.id}`,
    categoria: 'comunicado',
    clienteId: comunicado.cliente_id,
    clienteNome: comunicado.clientes?.nome_empresa ?? 'Cliente',
    descricao: comunicado.titulo,
    dataEnvio: comunicado.created_at,
    visualizadoEm: comunicado.visualizado_pelo_cliente_em,
    falhaEntrega: comunicado.resend_email_id ? (eventosFalha.get(comunicado.resend_email_id) ?? null) : null,
  }))

  const itensDocumentos: ItemEnvio[] = (documentosRes.data ?? [])
    .filter((documento) => !!documento.enviado_em)
    .map((documento) => ({
      id: `documento-${documento.id}`,
      categoria: 'documento',
      clienteId: documento.cliente_id,
      clienteNome: documento.clientes?.nome_empresa ?? 'Cliente',
      descricao: documento.nome_arquivo,
      dataEnvio: documento.enviado_em as string,
      visualizadoEm: documento.visualizado_pelo_cliente_em,
      falhaEntrega: documento.resend_email_id ? (eventosFalha.get(documento.resend_email_id) ?? null) : null,
    }))

  const itensSolicitacoes: ItemEnvio[] = (solicitacoesRes.data ?? []).map((envio) => ({
    id: `solicitacao-${envio.id}`,
    categoria: 'solicitacao_mensal',
    clienteId: envio.cliente_id,
    clienteNome: envio.clientes?.nome_empresa ?? 'Cliente',
    descricao: `${TIPO_ENVIO_LABEL[envio.tipo] ?? envio.tipo} — ${formatarCompetenciaCurta(envio.competencia)}`,
    dataEnvio: envio.enviado_em,
    visualizadoEm: envio.visualizado_pelo_cliente_em,
    falhaEntrega: envio.resend_email_id ? (eventosFalha.get(envio.resend_email_id) ?? null) : null,
  }))

  const todosItens = [...itensComunicados, ...itensDocumentos, ...itensSolicitacoes].sort(
    (a, b) => new Date(b.dataEnvio).getTime() - new Date(a.dataEnvio).getTime()
  )

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">Controle de Envios</h1>
      <p className="mb-8 text-sm text-navy-soft">
        Tudo que foi enviado a clientes recentemente — comunicados, documentos e solicitações mensais —
        com status de visualização.
      </p>

      <ControleEnviosTabela itens={todosItens} />
    </div>
  )
}

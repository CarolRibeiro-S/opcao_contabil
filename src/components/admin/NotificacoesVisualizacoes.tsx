import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { IconOlho } from '@/components/shared/icons'

const JANELA_HORAS = 24

// Card agregado (contagem, não lista por evento) — substitui o antigo
// VisualizacoesRecentesBanner, que ficava enorme com o crescimento do
// volume de clientes. Honorários (cobrancas) fica de fora de propósito,
// assim como em /admin/controle-envios, que já tem tela própria em
// /admin/cobrancas. Não existe um "admin já viu isso" persistido pra
// comunicados/documentos/solicitação mensal (diferente de
// comunicados.visto_em, que serve outra finalidade) — "novo" aqui continua
// aproximado pela janela de 24h, mesma convenção de antes.
export default async function NotificacoesVisualizacoes() {
  const supabase = await createClient()

  const desde = new Date(Date.now() - JANELA_HORAS * 60 * 60 * 1000).toISOString()

  const [comunicadosRes, documentosRes, solicitacoesRes] = await Promise.all([
    supabase
      .from('comunicados')
      .select('id', { count: 'exact', head: true })
      .not('visualizado_pelo_cliente_em', 'is', null)
      .gte('visualizado_pelo_cliente_em', desde),
    supabase
      .from('documentos_clientes')
      .select('id', { count: 'exact', head: true })
      .not('visualizado_pelo_cliente_em', 'is', null)
      .gte('visualizado_pelo_cliente_em', desde),
    supabase
      .from('envios_solicitacao_mensal')
      .select('id', { count: 'exact', head: true })
      .not('visualizado_pelo_cliente_em', 'is', null)
      .gte('visualizado_pelo_cliente_em', desde),
  ])

  const total = (comunicadosRes.count ?? 0) + (documentosRes.count ?? 0) + (solicitacoesRes.count ?? 0)

  if (total === 0) return null

  const plural = total > 1 ? 'ões' : 'ão'

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <IconOlho className="h-5 w-5 shrink-0 text-blue-600" />
        <p className="text-sm text-blue-800">
          Você tem <strong>{total}</strong> confirmaç{plural} de leitura
        </p>
      </div>
      <Link
        href="/admin/controle-envios"
        className="shrink-0 text-sm font-semibold text-blue-800 underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-blue-900"
      >
        Ver detalhes
      </Link>
    </div>
  )
}

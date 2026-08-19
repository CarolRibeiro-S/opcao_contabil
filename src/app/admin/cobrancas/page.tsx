import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CobrancasTable, { type FalhaEntrega } from '@/components/admin/CobrancasTable'

type Cobranca = {
  id: string
  competencia: string | null
  valor: number | null
  status: string
  data_vencimento: string | null
  descricao: string | null
  boleto_caminho_arquivo: string | null
  enviado_email_em: string | null
  resend_email_id: string | null
  clientes: { nome_empresa: string } | null
}

type EventoRow = { resend_email_id: string; tipo: string; detalhe: string | null; criado_em: string }

// email_eventos tem RLS habilitado sem nenhuma policy (de propósito — ver
// migration) — só a service role (createAdminClient) consegue ler. Mesmo
// raciocínio já usado pra last_sign_in_at em admin/clientes/page.tsx: em
// vez de escrever uma policy nova que reproduza a lógica de "é admin"
// (motivo do aviso de segurança do is_admin() ficar exposto), a tabela
// simplesmente não é alcançável pela API pública — só por código
// server-side de confiança, com a service role key.
//
// "Mais recente vence": se um resend_email_id tiver mais de um evento (ex:
// delivery_delayed seguido de bounced), o mapa fica só com o último,
// porque a query já vem ordenada por criado_em crescente.
async function buscarEventosFalha(resendEmailIds: string[]): Promise<Map<string, FalhaEntrega>> {
  if (resendEmailIds.length === 0) return new Map()

  const supabaseAdmin = createAdminClient()

  const { data, error } = await supabaseAdmin
    .from('email_eventos')
    .select('resend_email_id, tipo, detalhe, criado_em')
    .in('resend_email_id', resendEmailIds)
    .order('criado_em', { ascending: true })
    .returns<EventoRow[]>()

  if (error) {
    console.error('[admin/cobrancas] Erro ao buscar email_eventos:', error)
    return new Map()
  }

  const mapa = new Map<string, FalhaEntrega>()
  for (const evento of data ?? []) {
    mapa.set(evento.resend_email_id, { tipo: evento.tipo, detalhe: evento.detalhe, criadoEm: evento.criado_em })
  }
  return mapa
}

export default async function CobrancasPage() {
  const supabase = await createClient()

  const { data: cobrancas } = await supabase
    .from('cobrancas')
    .select('*, clientes(nome_empresa)')
    .order('data_vencimento', { ascending: true })
    .returns<Cobranca[]>()

  const idsComEmail = (cobrancas ?? [])
    .map((cobranca) => cobranca.resend_email_id)
    .filter((id): id is string => !!id)

  const eventosFalha = await buscarEventosFalha(idsComEmail)

  const cobrancasComFalha = (cobrancas ?? []).map((cobranca) => ({
    ...cobranca,
    falhaEntrega: cobranca.resend_email_id ? (eventosFalha.get(cobranca.resend_email_id) ?? null) : null,
  }))

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Honorários Contábeis</h1>
        <Link
          href="/admin/cobrancas/nova"
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
        >
          + Novo Honorário
        </Link>
      </div>

      {/* mt-[61px]: alinha o início do conteúdo com a linha azul de
          navegação da sidebar (mesmo cálculo de Clientes/Tarefas/Prazos:
          161px de altura do cabeçalho da sidebar, menos os 100px que
          padding-top do <main> (64px) + a linha de título+botão (36px) já
          ocupam). */}
      <div className="mt-[61px]">
        {cobrancasComFalha.length === 0 ? (
          <p className="text-sm text-navy-soft">Nenhum honorário cadastrado ainda.</p>
        ) : (
          <CobrancasTable cobrancas={cobrancasComFalha} />
        )}
      </div>
    </div>
  )
}

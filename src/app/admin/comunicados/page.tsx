import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ComunicadosTable from '@/components/admin/ComunicadosTable'

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

export default async function ComunicadosPage() {
  const supabase = await createClient()

  const { data: comunicados } = await supabase
    .from('comunicados')
    .select('id, cliente_id, titulo, tipo, status, requer_resposta, created_at, clientes(nome_empresa)')
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<Comunicado[]>()

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Comunicados</h1>
          <p className="mt-1 text-sm text-navy-soft">Avisos e solicitações enviados aos clientes</p>
        </div>
        <Link
          href="/admin/comunicados/novo"
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
        >
          + Novo Comunicado
        </Link>
      </div>

      {/* mt-[41px]: alinha o início do conteúdo com a linha azul de
          navegação da sidebar (161px de altura do cabeçalho da sidebar,
          menos os 120px que padding-top do <main> (64px) + o bloco de
          título+subtítulo desta página (56px: h1 + colapso de 4px + o
          parágrafo "Avisos e solicitações...") já ocupam — mesmo cálculo já
          usado no Dashboard). */}
      <div className="mt-[41px]">
      {!comunicados || comunicados.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum comunicado enviado ainda.</p>
      ) : (
        <ComunicadosTable comunicados={comunicados} />
      )}
      </div>
    </div>
  )
}

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PrazosKanban from '@/components/admin/PrazosKanban'

type Prazo = {
  id: string
  competencia: string | null
  data_vencimento: string | null
  status: string
  clientes: { nome_empresa: string } | null
  obrigacoes_acessorias: { nome: string } | null
}

export default async function PrazosPage() {
  const supabase = await createClient()

  const { data: prazos } = await supabase
    .from('prazos')
    .select('*, clientes(nome_empresa), obrigacoes_acessorias(nome)')
    .order('data_vencimento', { ascending: true })
    .returns<Prazo[]>()

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Prazos</h1>
        <Link
          href="/admin/prazos/novo"
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
        >
          + Novo Prazo
        </Link>
      </div>

      {!prazos || prazos.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum prazo cadastrado ainda.</p>
      ) : (
        <PrazosKanban prazos={prazos} />
      )}
    </div>
  )
}

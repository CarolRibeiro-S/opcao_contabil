import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PrazosView from '@/components/admin/PrazosView'
import GerarPrazosButton from '@/components/admin/GerarPrazosButton'

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

export default async function PrazosPage() {
  const supabase = await createClient()

  const { data: prazos } = await supabase
    .from('prazos')
    .select('*, clientes(nome_empresa), obrigacoes_acessorias(nome)')
    .order('data_vencimento', { ascending: true })
    .returns<Prazo[]>()

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Prazos</h1>
        <div className="flex flex-wrap items-center gap-3">
          <GerarPrazosButton />
          <Link
            href="/admin/prazos/novo"
            className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
          >
            + Novo Prazo
          </Link>
        </div>
      </div>

      {/* mt-[61px]: alinha o início do conteúdo com a linha azul de
          navegação da sidebar (mesmo cálculo de Clientes/Tarefas: 161px de
          altura do cabeçalho da sidebar, menos os 100px que padding-top do
          <main> (64px) + a linha de título+botões (36px, dominada pelo
          botão "+ Novo Prazo") já ocupam). */}
      <div className="mt-[61px]">
        {!prazos || prazos.length === 0 ? (
          <p className="text-sm text-navy-soft">Nenhum prazo cadastrado ainda.</p>
        ) : (
          <PrazosView prazos={prazos} />
        )}
      </div>
    </div>
  )
}

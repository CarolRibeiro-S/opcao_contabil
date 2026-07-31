import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditarReceitaForm, { type Receita } from '@/components/admin/EditarReceitaForm'

export default async function EditarReceitaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: receita } = await supabase
    .from('receitas')
    .select(
      'id, descricao, categoria_id, categorias_financeiras(nome), valor, competencia, data_vencimento, data_recebimento, observacao, origem'
    )
    .eq('id', id)
    .single<Receita>()

  if (!receita) {
    notFound()
  }

  return <EditarReceitaForm receita={receita} />
}

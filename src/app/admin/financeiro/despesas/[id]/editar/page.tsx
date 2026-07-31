import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditarDespesaForm, { type Despesa } from '@/components/admin/EditarDespesaForm'

export default async function EditarDespesaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: despesa } = await supabase
    .from('despesas')
    .select(
      'id, descricao, categoria_id, categorias_financeiras(nome), valor, competencia, data_vencimento, data_pagamento, observacao'
    )
    .eq('id', id)
    .single<Despesa>()

  if (!despesa) {
    notFound()
  }

  return <EditarDespesaForm despesa={despesa} />
}

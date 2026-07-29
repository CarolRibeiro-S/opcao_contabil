import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditarDespesaForm from '@/components/admin/EditarDespesaForm'

export default async function EditarDespesaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: despesa } = await supabase
    .from('despesas')
    .select('id, descricao, categoria, valor, competencia, data_pagamento')
    .eq('id', id)
    .single()

  if (!despesa) {
    notFound()
  }

  return <EditarDespesaForm despesa={despesa} />
}

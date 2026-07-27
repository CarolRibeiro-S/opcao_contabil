import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditarCobrancaForm from '@/components/admin/EditarCobrancaForm'

export default async function EditarCobrancaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cobranca } = await supabase
    .from('cobrancas')
    .select('id, cliente_id, competencia, valor, data_vencimento')
    .eq('id', id)
    .single()

  if (!cobranca) {
    notFound()
  }

  return <EditarCobrancaForm cobranca={cobranca} />
}

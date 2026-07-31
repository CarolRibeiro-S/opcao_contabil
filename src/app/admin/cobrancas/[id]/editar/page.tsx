import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditarCobrancaForm, { type Cobranca } from '@/components/admin/EditarCobrancaForm'

export default async function EditarCobrancaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cobranca } = await supabase
    .from('cobrancas')
    .select('id, cliente_id, descricao, competencia, valor, data_vencimento, clientes(nome_empresa)')
    .eq('id', id)
    .single<Cobranca>()

  if (!cobranca) {
    notFound()
  }

  return <EditarCobrancaForm cobranca={cobranca} />
}

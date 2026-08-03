import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditarPrazoForm, { type Prazo } from '@/components/admin/EditarPrazoForm'

export default async function EditarPrazoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: prazo } = await supabase
    .from('prazos')
    .select('id, competencia, data_vencimento, status, observacoes, clientes(nome_empresa), obrigacoes_acessorias(nome)')
    .eq('id', id)
    .single<Prazo>()

  if (!prazo) {
    notFound()
  }

  return <EditarPrazoForm prazo={prazo} />
}

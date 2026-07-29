import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditarEquipeForm from '@/components/admin/EditarEquipeForm'

export default async function EditarMembroPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: membro } = await supabase
    .from('profiles')
    .select('id, nome, email, telefone, cargo, permissoes')
    .eq('id', id)
    .eq('role', 'admin')
    .single()

  if (!membro) {
    notFound()
  }

  return <EditarEquipeForm membro={membro} />
}

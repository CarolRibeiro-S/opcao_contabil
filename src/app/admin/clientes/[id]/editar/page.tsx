import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditarClienteForm from '@/components/admin/EditarClienteForm'

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from('clientes')
    .select(
      'id, nome_empresa, codigo_interno, apelido, cnpj_cpf, tipo, regime_tributario, segmento, responsavel, email, telefone, observacoes, status'
    )
    .eq('id', id)
    .single()

  if (!cliente) {
    notFound()
  }

  const { data: profissionais } = await supabase
    .from('profissionais_clinica')
    .select('nome')
    .eq('cliente_id', id)

  const { data: documentos } = await supabase
    .from('documentos_clientes')
    .select('id, nome_arquivo, tipo, caminho_arquivo')
    .eq('cliente_id', id)

  const documentosComUrl = await Promise.all(
    (documentos ?? []).map(async (documento) => {
      const { data: signedUrlData } = await supabase.storage
        .from('documentos-clientes')
        .createSignedUrl(documento.caminho_arquivo, 3600)

      return { ...documento, signedUrl: signedUrlData?.signedUrl ?? null }
    })
  )

  return (
    <EditarClienteForm
      cliente={cliente}
      profissionaisIniciais={(profissionais ?? []).map((profissional) => profissional.nome)}
      documentosIniciais={documentosComUrl}
    />
  )
}

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
      'id, nome_empresa, codigo_interno, apelido, cnpj_cpf, tipo, regime_tributario, possui_empregados, obrigado_efd_contribuicoes, emite_notas_fiscais, segmento, responsavel, email, telefone, honorario_valor_mensal, honorario_dia_vencimento, observacoes, status, profile_id'
    )
    .eq('id', id)
    .single()

  if (!cliente) {
    notFound()
  }

  // E-mail real da conta vinculada, pra avisar na tela quando divergir do
  // campo de contato (clientes.email, editável) — ver ConvidarClientePortal
  // e a rota de reenvio, que usam esse e-mail real, não o do formulário.
  let emailContaVinculada: string | null = null
  if (cliente.profile_id) {
    const supabaseAdmin = createAdminClient()
    const { data: contaVinculada } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', cliente.profile_id)
      .maybeSingle()
    emailContaVinculada = contaVinculada?.email ?? null
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
      emailContaVinculada={emailContaVinculada}
    />
  )
}

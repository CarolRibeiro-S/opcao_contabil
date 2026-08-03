import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailComunicado } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

type Falha = { clienteId: string; nomeCliente: string; motivo: string }

type ClienteResumo = { id: string; nome_empresa: string; email: string | null }

// Um anexo já vem enviado (upload feito direto do navegador pro Storage,
// mesmo padrão do ThreadComunicado) antes desta rota ser chamada — aqui só
// falta vincular o arquivo já salvo ao comunicado/mensagem do cliente certo.
type AnexoLote = { cliente_id: string; nome_arquivo: string; caminho_arquivo: string; tipo_arquivo: string }

function anexosValidos(valor: unknown): valor is AnexoLote[] {
  if (valor === undefined) return true
  if (!Array.isArray(valor)) return false

  return valor.every(
    (item) =>
      item &&
      typeof item.cliente_id === 'string' &&
      typeof item.nome_arquivo === 'string' &&
      typeof item.caminho_arquivo === 'string' &&
      typeof item.tipo_arquivo === 'string'
  )
}

// Recebe um lote por chamada (o front divide em lotes de 10 e chama essa
// rota uma vez por lote, mesmo padrão já usado no Envio Mensal) — não é a
// rota que faz o batching, é o EnvioComunicadosForm no client.
export async function POST(request: Request) {
  const supabaseAuth = await createClient()

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { data: profile } = await supabaseAuth.from('profiles').select('role, nome').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)

  if (
    !body ||
    (body.tipo !== 'aviso' && body.tipo !== 'solicitacao_documento') ||
    typeof body.titulo !== 'string' ||
    !body.titulo.trim() ||
    typeof body.mensagem !== 'string' ||
    !body.mensagem.trim() ||
    !Array.isArray(body.cliente_ids) ||
    body.cliente_ids.length === 0 ||
    !body.cliente_ids.every((id: unknown) => typeof id === 'string' && id) ||
    !anexosValidos(body.anexos) ||
    (body.requer_resposta !== undefined && typeof body.requer_resposta !== 'boolean')
  ) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const tipo = body.tipo as 'aviso' | 'solicitacao_documento'
  const titulo = body.titulo.trim()
  const mensagem = body.mensagem.trim()
  const clienteIds = body.cliente_ids as string[]
  const anexos = (body.anexos as AnexoLote[] | undefined) ?? []
  const anexoPorClienteId = new Map(anexos.map((anexo) => [anexo.cliente_id, anexo]))
  // "Apenas aviso" (checkbox só disponível pro tipo 'aviso' no formulário)
  // manda requer_resposta=false, mas o comunicado nasce 'pendente' igual aos
  // outros — requer_resposta só dispensa o cliente de ESCREVER algo, mas ele
  // ainda precisa dar ciência (botão "Estou ciente" no ThreadComunicado) pra
  // fechar a conversa sozinho.
  const requerResposta = (body.requer_resposta as boolean | undefined) ?? true

  const supabaseAdmin = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data: clientes } = await supabaseAdmin
    .from('clientes')
    .select('id, nome_empresa, email')
    .in('id', clienteIds)
    .returns<ClienteResumo[]>()

  const clientePorId = new Map((clientes ?? []).map((cliente) => [cliente.id, cliente]))

  let comunicadosCriados = 0
  let emailsEnviados = 0
  let pulados = 0
  const falhas: Falha[] = []

  for (const clienteId of clienteIds) {
    const cliente = clientePorId.get(clienteId)

    if (!cliente) {
      falhas.push({ clienteId, nomeCliente: 'Desconhecido', motivo: 'Cliente não encontrado.' })
      continue
    }

    const { data: comunicadoCriado, error: insertError } = await supabaseAdmin
      .from('comunicados')
      .insert({
        cliente_id: clienteId,
        tipo,
        titulo,
        mensagem,
        status: 'pendente',
        requer_resposta: requerResposta,
        enviado_por: user.id,
      })
      .select('id')
      .single()

    if (insertError || !comunicadoCriado) {
      falhas.push({
        clienteId,
        nomeCliente: cliente.nome_empresa,
        motivo: 'Não foi possível salvar o comunicado.',
      })
      continue
    }

    // O comunicado é o início de uma conversa (thread): a mensagem original
    // vira automaticamente a primeira entrada em mensagens_comunicado —
    // mesmo critério usado na migração dos comunicados antigos e no envio
    // individual (ComunicadosCliente.tsx).
    await supabaseAdmin.from('mensagens_comunicado').insert({
      comunicado_id: comunicadoCriado.id,
      autor_tipo: 'admin',
      autor_id: user.id,
      autor_nome: profile?.nome ?? 'Opção Contábil',
      mensagem,
    })

    // Anexo opcional já na criação em massa: o arquivo já foi enviado ao
    // Storage (uma cópia por cliente, feita pelo navegador antes de chamar
    // esta rota) — aqui só falta registrar em documentos_clientes e criar a
    // segunda mensagem da thread com o vínculo, mesmo padrão do envio
    // individual. Falha aqui não derruba o comunicado em si (que já foi
    // criado com sucesso), só fica registrada no console.
    const anexoDoCliente = anexoPorClienteId.get(clienteId)
    if (anexoDoCliente) {
      const { data: documento, error: documentoError } = await supabaseAdmin
        .from('documentos_clientes')
        .insert({
          cliente_id: clienteId,
          comunicado_id: comunicadoCriado.id,
          nome_arquivo: anexoDoCliente.nome_arquivo,
          tipo: anexoDoCliente.tipo_arquivo,
          caminho_arquivo: anexoDoCliente.caminho_arquivo,
        })
        .select('id')
        .single()

      if (documentoError || !documento) {
        console.error(
          `[api/comunicados/enviar-massa] Erro ao vincular anexo do cliente ${clienteId}:`,
          documentoError
        )
      } else {
        await supabaseAdmin.from('mensagens_comunicado').insert({
          comunicado_id: comunicadoCriado.id,
          autor_tipo: 'admin',
          autor_id: user.id,
          autor_nome: profile?.nome ?? 'Opção Contábil',
          mensagem: '',
          documento_id: documento.id,
        })
      }
    }

    comunicadosCriados += 1

    // Cliente sem e-mail: o registro fica salvo (aparece pro cliente assim
    // que ele for convidado e acessar o portal), só não dá pra notificar por
    // e-mail agora.
    if (!cliente.email) {
      pulados += 1
      continue
    }

    const { subject, html } = emailComunicado({
      nomeCliente: cliente.nome_empresa,
      titulo,
      mensagem,
      tipo,
    })

    const { error: emailError } = await resend.emails.send({
      from: 'naoresponda@opcaocontabilbsb.com.br',
      to: cliente.email,
      subject,
      html,
    })

    if (emailError) {
      falhas.push({
        clienteId,
        nomeCliente: cliente.nome_empresa,
        motivo: 'Comunicado salvo, mas o e-mail falhou ao enviar.',
      })
      continue
    }

    emailsEnviados += 1
  }

  return NextResponse.json({ comunicadosCriados, emailsEnviados, pulados, falhas })
}

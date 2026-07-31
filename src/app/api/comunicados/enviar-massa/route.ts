import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailComunicado } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

type Falha = { clienteId: string; nomeCliente: string; motivo: string }

type ClienteResumo = { id: string; nome_empresa: string; email: string | null }

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

  const { data: profile } = await supabaseAuth.from('profiles').select('role').eq('id', user.id).single()

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
    !body.cliente_ids.every((id: unknown) => typeof id === 'string' && id)
  ) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const tipo = body.tipo as 'aviso' | 'solicitacao_documento'
  const titulo = body.titulo.trim()
  const mensagem = body.mensagem.trim()
  const clienteIds = body.cliente_ids as string[]

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

    const { error: insertError } = await supabaseAdmin.from('comunicados').insert({
      cliente_id: clienteId,
      tipo,
      titulo,
      mensagem,
      status: 'pendente',
      enviado_por: user.id,
    })

    if (insertError) {
      falhas.push({
        clienteId,
        nomeCliente: cliente.nome_empresa,
        motivo: 'Não foi possível salvar o comunicado.',
      })
      continue
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

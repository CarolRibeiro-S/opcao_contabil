import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarHistorico } from '@/lib/historico'
import { avaliarConflitoApelidoExtra, contemComoPalavraInteira, tokenizar, type ClienteOption } from '@/lib/envioMensal'

export const dynamic = 'force-dynamic'

// Salva uma frase como apelido extra (clientes.apelidos_extra) de um
// cliente — usado pela tela de sugestões (Etapa 2, a partir do histórico
// de uploads) e pelo fluxo de "aprender com a correção manual" no Envio
// Mensal (Etapa 3, quando o admin resolve um arquivo ambíguo/manual à
// mão). Os dois SEMPRE passam por uma confirmação explícita antes de
// chamar esta rota — ela nunca é chamada sozinha, sem alguém ter clicado
// "Sim, salvar" — e mesmo assim recusa a gravação se a frase criar uma
// ambiguidade NOVA com outro cliente, o mesmo cuidado já usado pro
// vínculo de conta duplicada em /api/clientes/convidar.
export async function POST(request: Request) {
  const supabaseAuth = await createClient()

  let {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user) {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (token) {
      const { data } = await supabaseAuth.auth.getUser(token)
      user = data.user
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient()

  const { data: profile } = await supabaseAdmin.from('profiles').select('role, nome').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)

  const clienteId = typeof body?.cliente_id === 'string' ? body.cliente_id : ''
  const frase = typeof body?.frase === 'string' ? body.frase.trim() : ''

  if (!clienteId || !frase) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  // Todos os clientes ativos (não só o alvo) — a checagem de conflito
  // precisa saber se a frase bate em ALGUÉM MAIS, não só confirmar que o
  // cliente alvo existe.
  const { data: clientes, error: clientesError } = await supabaseAdmin
    .from('clientes')
    .select('id, nome_empresa, apelido, apelidos_extra, email, cnpj_cpf')
    .eq('status', 'ativo')
    .returns<ClienteOption[]>()

  if (clientesError || !clientes) {
    return NextResponse.json({ error: 'Não foi possível carregar os clientes.' }, { status: 500 })
  }

  const cliente = clientes.find((c) => c.id === clienteId)

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado (ou inativo).' }, { status: 404 })
  }

  const { conflita, comClientes } = avaliarConflitoApelidoExtra(frase, clienteId, clientes)

  if (conflita) {
    return NextResponse.json(
      {
        error: `Essa frase também bate em outro cliente: ${comClientes.map((c) => c.nome).join(', ')}. Tente algo mais específico.`,
        conflita: true,
        conflitaCom: comClientes,
      },
      { status: 409 }
    )
  }

  // Já coberta por uma variante existente (ex: sugestão repetida, ou
  // alguém tentando salvar de novo o que já foi aprovado antes) — não
  // duplica no campo, só confirma sucesso.
  const variantesAtuais = (cliente.apelidos_extra ?? '').split(',').map((v) => v.trim()).filter(Boolean)
  const jaCoberta = variantesAtuais.some((variante) => contemComoPalavraInteira(tokenizar(variante), frase))

  const novoApelidosExtra = jaCoberta ? cliente.apelidos_extra : [cliente.apelidos_extra, frase].filter(Boolean).join(', ')

  if (!jaCoberta) {
    const { error: updateError } = await supabaseAdmin
      .from('clientes')
      .update({ apelidos_extra: novoApelidosExtra })
      .eq('id', clienteId)

    if (updateError) {
      return NextResponse.json({ error: 'Não foi possível salvar o apelido extra.' }, { status: 500 })
    }

    await registrarHistorico({
      usuarioId: user.id,
      usuarioNome: profile?.nome ?? user.email ?? 'Administrador',
      acao: 'editou',
      entidade: 'cliente',
      entidadeId: clienteId,
      entidadeNome: cliente.nome_empresa,
      detalhes: `Apelido extra adicionado (Envio Mensal): "${frase}"`,
    })
  }

  return NextResponse.json({ sucesso: true, jaCoberta, apelidosExtra: novoApelidosExtra })
}

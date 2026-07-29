import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailImpostosMensal } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

type ArquivoGrupo = { chave: string; nomeArquivo: string; tipo: string; dataVencimento: string }
type Grupo = { clienteId: string; arquivos: ArquivoGrupo[] }

type Falha = { clienteId: string; nomeCliente: string; motivo: string }

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

  const formData = await request.formData()
  const competencia = formData.get('competencia')
  const gruposRaw = formData.get('grupos')

  if (typeof competencia !== 'string' || typeof gruposRaw !== 'string' || !competencia) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  let grupos: Grupo[]
  try {
    grupos = JSON.parse(gruposRaw)
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data: clientes } = await supabaseAdmin.from('clientes').select('id, nome_empresa, email')

  const clientePorId = new Map((clientes ?? []).map((cliente) => [cliente.id, cliente]))

  let emailsEnviados = 0
  const falhas: Falha[] = []

  for (const grupo of grupos) {
    const cliente = clientePorId.get(grupo.clienteId)

    if (!cliente) {
      falhas.push({ clienteId: grupo.clienteId, nomeCliente: 'Desconhecido', motivo: 'Cliente não encontrado.' })
      continue
    }

    if (!cliente.email) {
      falhas.push({
        clienteId: grupo.clienteId,
        nomeCliente: cliente.nome_empresa,
        motivo: 'Cliente sem e-mail cadastrado.',
      })
      continue
    }

    const anexos: { filename: string; content: string }[] = []
    const documentosParaInserir: {
      cliente_id: string
      nome_arquivo: string
      tipo: string
      caminho_arquivo: string
    }[] = []

    for (const arquivoInfo of grupo.arquivos) {
      const arquivo = formData.get(arquivoInfo.chave)

      if (!(arquivo instanceof File)) {
        continue
      }

      const caminhoArquivo = `${grupo.clienteId}/${arquivoInfo.nomeArquivo}`
      const arrayBuffer = await arquivo.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const { error: uploadError } = await supabaseAdmin.storage
        .from('documentos-clientes')
        .upload(caminhoArquivo, buffer, {
          contentType: arquivo.type || undefined,
          upsert: true,
        })

      if (uploadError) {
        continue
      }

      documentosParaInserir.push({
        cliente_id: grupo.clienteId,
        nome_arquivo: arquivoInfo.nomeArquivo,
        tipo: arquivoInfo.tipo,
        caminho_arquivo: caminhoArquivo,
      })

      anexos.push({ filename: arquivoInfo.nomeArquivo, content: buffer.toString('base64') })
    }

    if (anexos.length === 0) {
      falhas.push({
        clienteId: grupo.clienteId,
        nomeCliente: cliente.nome_empresa,
        motivo: 'Nenhum arquivo pôde ser enviado ao Storage.',
      })
      continue
    }

    const itens = grupo.arquivos
      .filter((arquivoInfo) => !!arquivoInfo.dataVencimento)
      .map((arquivoInfo) => ({
        tipo: arquivoInfo.tipo,
        dataVencimento: arquivoInfo.dataVencimento,
      }))

    const { subject, html } = emailImpostosMensal({
      nomeCliente: cliente.nome_empresa,
      competencia: `${competencia}-01`,
      itens,
    })

    const { error: emailError } = await resend.emails.send({
      from: 'naoresponda@opcaocontabilbsb.com.br',
      to: cliente.email,
      subject,
      html,
      attachments: anexos,
    })

    if (emailError) {
      falhas.push({
        clienteId: grupo.clienteId,
        nomeCliente: cliente.nome_empresa,
        motivo: 'Falha ao enviar o e-mail.',
      })
      continue
    }

    const agora = new Date().toISOString()

    const { error: insertError } = await supabaseAdmin.from('documentos_clientes').insert(
      documentosParaInserir.map((documento) => ({
        ...documento,
        enviado_por: user.id,
        enviado_em: agora,
      }))
    )

    if (insertError) {
      falhas.push({
        clienteId: grupo.clienteId,
        nomeCliente: cliente.nome_empresa,
        motivo: 'E-mail enviado, mas houve um erro ao registrar os documentos.',
      })
      continue
    }

    emailsEnviados += 1
  }

  return NextResponse.json({
    emailsEnviados,
    totalClientes: grupos.length,
    falhas,
  })
}

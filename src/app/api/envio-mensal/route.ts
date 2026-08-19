import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailImpostosMensal } from '@/lib/email/templates'
import { TIPOS_SEM_VENCIMENTO } from '@/lib/envioMensal'
import { sanitizarNomeArquivo } from '@/lib/storage/sanitizarNomeArquivo'

export const dynamic = 'force-dynamic'

// Mesmo problema (e mesma correção) do cron/prazos: processamento sequencial
// de um cliente por vez — aqui ainda mais pesado, porque cada item envolve
// upload de arquivo(s) pro Storage e um e-mail com anexo em base64, não só
// um e-mail de texto. Era exatamente isso que fazia até um lote de 5
// clientes (TAMANHO_LOTE do frontend, ver EnvioMensalConfirmacao.tsx)
// estourar o tempo da function e voltar "Falha de rede ou tempo esgotado"
// pra todo mundo daquele lote, mesmo que nenhum e-mail tivesse falhado de
// verdade — só não deu tempo de processar. O Next.js exige que
// "maxDuration" seja um literal (testado no cron/prazos: referência de
// const quebra o build) — por isso não dá pra compartilhar o mesmo valor
// via variável com o cálculo da trava de tempo logo abaixo. SE MUDAR UM,
// MUDE O OUTRO.
export const maxDuration = 60
const MAX_DURATION_SEGUNDOS = 60

// Quantos clientes processamos ao mesmo tempo. Na prática, cada requisição
// já chega com no máximo TAMANHO_LOTE (5, do frontend) clientes de uma vez,
// então isso processa o lote inteiro em paralelo — mas mantém um teto caso
// esse valor do frontend mude no futuro.
const TAMANHO_LOTE_ENVIO = 10

// Rede de segurança contra o lote ainda demorar demais (upload de arquivo
// grande, Storage lento, etc.): ao passar de 80% do maxDuration, para de
// começar clientes NOVOS e devolve uma resposta com o que já foi
// processado — em vez de deixar a Vercel matar a function no meio, o que
// derruba a conexão inteira e faz até quem já tinha sido enviado com
// sucesso aparecer como falha pro admin (a causa raiz do bug reportado).
// Quem não deu tempo de processar entra em "falhas" com um motivo
// específico, orientando reenviar só esses — sem duplicar quem já recebeu
// (o e-mail desses já foi confirmado enviado E o registro em
// documentos_clientes já foi gravado antes da trava entrar em ação).
const FRACAO_LIMITE_TEMPO = 0.8
const LIMITE_TEMPO_MS = MAX_DURATION_SEGUNDOS * 1000 * FRACAO_LIMITE_TEMPO

function tempoEsgotado(inicioExecucao: number): boolean {
  return Date.now() - inicioExecucao > LIMITE_TEMPO_MS
}

type ResultadoLotes = { processados: number; interrompidoPorTempo: boolean }

// Roda `tarefa` em paralelo pra cada item da lista, em lotes de
// `tamanhoLote` por vez. Antes de CADA lote novo (nunca no meio de um lote
// já em andamento), confere se já passou de FRACAO_LIMITE_TEMPO do tempo
// disponível — se sim, para ali e devolve quantos itens ficaram de fora.
async function emLotes<T>(
  itens: T[],
  tamanhoLote: number,
  inicioExecucao: number,
  tarefa: (item: T) => Promise<void>
): Promise<ResultadoLotes> {
  for (let i = 0; i < itens.length; i += tamanhoLote) {
    if (tempoEsgotado(inicioExecucao)) {
      console.error(
        `[envio-mensal] Tempo esgotado (>${FRACAO_LIMITE_TEMPO * 100}% de ${MAX_DURATION_SEGUNDOS}s) — parando com ${itens.length - i} cliente(s) não processado(s).`
      )
      return { processados: i, interrompidoPorTempo: true }
    }

    const lote = itens.slice(i, i + tamanhoLote)
    await Promise.all(lote.map((item) => tarefa(item)))
  }

  return { processados: itens.length, interrompidoPorTempo: false }
}

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

  const inicioExecucao = Date.now()

  const supabaseAdmin = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data: clientes } = await supabaseAdmin.from('clientes').select('id, nome_empresa, email')

  const clientePorId = new Map((clientes ?? []).map((cliente) => [cliente.id, cliente]))

  let emailsEnviados = 0
  const falhas: Falha[] = []

  const resultado = await emLotes(grupos, TAMANHO_LOTE_ENVIO, inicioExecucao, async (grupo) => {
    const cliente = clientePorId.get(grupo.clienteId)

    if (!cliente) {
      falhas.push({ clienteId: grupo.clienteId, nomeCliente: 'Desconhecido', motivo: 'Cliente não encontrado.' })
      return
    }

    if (!cliente.email) {
      falhas.push({
        clienteId: grupo.clienteId,
        nomeCliente: cliente.nome_empresa,
        motivo: 'Cliente sem e-mail cadastrado.',
      })
      return
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

      const caminhoArquivo = `${grupo.clienteId}/${sanitizarNomeArquivo(arquivoInfo.nomeArquivo)}`
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
      return
    }

    const itens = grupo.arquivos
      .filter((arquivoInfo) => !!arquivoInfo.dataVencimento && !TIPOS_SEM_VENCIMENTO.includes(arquivoInfo.tipo))
      .map((arquivoInfo) => ({
        tipo: arquivoInfo.tipo,
        dataVencimento: arquivoInfo.dataVencimento,
      }))

    const itensInformativos = [
      ...new Set(
        grupo.arquivos
          .filter((arquivoInfo) => TIPOS_SEM_VENCIMENTO.includes(arquivoInfo.tipo))
          .map((arquivoInfo) => arquivoInfo.tipo)
      ),
    ]

    const { subject, html } = emailImpostosMensal({
      nomeCliente: cliente.nome_empresa,
      competencia: `${competencia}-01`,
      itens,
      itensInformativos,
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
      return
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
      return
    }

    emailsEnviados += 1
  })

  // Clientes que sobraram porque a trava de tempo interrompeu antes de
  // chegar neles — nunca tiveram e-mail nem upload tentados, então é seguro
  // reenviar só esses depois, sem risco de duplicar nada.
  if (resultado.interrompidoPorTempo) {
    for (const grupo of grupos.slice(resultado.processados)) {
      const cliente = clientePorId.get(grupo.clienteId)
      falhas.push({
        clienteId: grupo.clienteId,
        nomeCliente: cliente?.nome_empresa ?? 'Cliente',
        motivo: 'Não processado a tempo neste lote — reenvie este(s) cliente(s) separadamente.',
      })
    }
  }

  return NextResponse.json({
    emailsEnviados,
    totalClientes: grupos.length,
    falhas,
    interrompidoPorTempo: resultado.interrompidoPorTempo,
  })
}

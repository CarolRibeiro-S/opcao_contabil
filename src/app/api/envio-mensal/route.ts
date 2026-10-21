import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailImpostosMensal } from '@/lib/email/templates'
import { TIPOS_SEM_VENCIMENTO } from '@/lib/envioMensal'
import { sanitizarNomeArquivo } from '@/lib/storage/sanitizarNomeArquivo'

export const dynamic = 'force-dynamic'

const BUCKET_DOCUMENTOS = 'documentos-clientes'

// Processamento sequencial de um cliente por vez — aqui ainda mais pesado,
// porque cada item envolve baixar arquivo(s) do Storage, subir pro caminho
// definitivo, e montar um e-mail com anexo em base64, não só um e-mail de
// texto. Era exatamente isso que fazia até um lote de 5 clientes
// (TAMANHO_LOTE do frontend, ver EnvioMensalConfirmacao.tsx) estourar o
// tempo da function e voltar "Falha de rede ou tempo esgotado" pra todo
// mundo daquele lote, mesmo que nenhum e-mail tivesse falhado de verdade.
//
// IMPORTANTE (investigação de 2026-10-21): existia uma SEGUNDA causa raiz
// pra essa mesma mensagem de erro, mais comum na prática — o limite de
// 4,5 MB de payload de requisição da própria Vercel (plataforma, não
// configurável). Antes, o navegador mandava os arquivos BINÁRIOS direto
// nesta requisição (multipart/form-data); 2 anexos um pouco maiores (ex:
// contrato social escaneado) já passavam de 4,5 MB e a Vercel rejeitava a
// requisição ANTES desta function rodar — o front recebia uma resposta
// que não era o JSON esperado, o que quebrava em resposta.json() e caía
// no mesmo "Falha de rede ou tempo esgotado", mascarando a causa real.
// A correção: a Etapa 2 (EnvioMensalArquivos.tsx) já sobe cada arquivo pro
// Storage (prefixo envio-mensal-temp/) assim que é selecionado; esta rota
// agora recebe só um JSON pequeno com os CAMINHOS, nunca os bytes — o
// corpo da requisição nunca mais chega perto de 4,5 MB, seja qual for o
// tamanho real dos PDFs.
export const maxDuration = 60
const MAX_DURATION_SEGUNDOS = 60

// Quantos clientes processamos ao mesmo tempo. Na prática, cada requisição
// já chega com no máximo TAMANHO_LOTE (5, do frontend) clientes de uma vez,
// então isso processa o lote inteiro em paralelo — mas mantém um teto caso
// esse valor do frontend mude no futuro.
const TAMANHO_LOTE_ENVIO = 10

// Rede de segurança contra o lote ainda demorar demais (Storage lento,
// Resend lento, etc.): ao passar de 80% do maxDuration, para de começar
// clientes NOVOS e devolve uma resposta com o que já foi processado — em
// vez de deixar a Vercel matar a function no meio, o que derruba a conexão
// inteira e faz até quem já tinha sido enviado com sucesso aparecer como
// falha pro admin (a causa raiz do bug reportado em 15/08). Quem não deu
// tempo de processar entra em "falhas" com um motivo específico,
// orientando reenviar só esses — sem duplicar quem já recebeu (o e-mail
// desses já foi confirmado enviado E o registro em documentos_clientes já
// foi gravado antes da trava entrar em ação).
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

type ArquivoGrupo = {
  chave: string
  nomeArquivo: string
  tipo: string
  dataVencimento: string
  // Caminho no bucket documentos-clientes (prefixo envio-mensal-temp/) —
  // gravado pela Etapa 2 assim que o upload terminou. null significa que
  // o upload nunca completou (não devia chegar até aqui, mas tratado como
  // "nada pra anexar" por segurança).
  caminhoStorageTemp: string | null
}
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

  const body = await request.json().catch(() => null)

  if (!body || typeof body.competencia !== 'string' || !body.competencia || !Array.isArray(body.grupos)) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const competencia = body.competencia as string
  const grupos = body.grupos as Grupo[]

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
    // Só esvaziado (apagado do Storage) se o cliente inteiro der certo —
    // ver comentário perto do fim desta função.
    const caminhosTempParaApagar: string[] = []

    for (const arquivoInfo of grupo.arquivos) {
      if (!arquivoInfo.caminhoStorageTemp) continue

      const { data: arquivoBaixado, error: downloadError } = await supabaseAdmin.storage
        .from(BUCKET_DOCUMENTOS)
        .download(arquivoInfo.caminhoStorageTemp)

      if (downloadError || !arquivoBaixado) {
        console.error('[envio-mensal] Erro ao baixar arquivo temporário do Storage:', downloadError, arquivoInfo.caminhoStorageTemp)
        continue
      }

      const buffer = Buffer.from(await arquivoBaixado.arrayBuffer())
      const caminhoArquivo = `${grupo.clienteId}/${sanitizarNomeArquivo(arquivoInfo.nomeArquivo)}`

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_DOCUMENTOS)
        .upload(caminhoArquivo, buffer, {
          contentType: arquivoBaixado.type || undefined,
          upsert: true,
        })

      if (uploadError) {
        console.error('[envio-mensal] Erro ao gravar arquivo no caminho definitivo:', uploadError)
        continue
      }

      documentosParaInserir.push({
        cliente_id: grupo.clienteId,
        nome_arquivo: arquivoInfo.nomeArquivo,
        tipo: arquivoInfo.tipo,
        caminho_arquivo: caminhoArquivo,
      })

      anexos.push({ filename: arquivoInfo.nomeArquivo, content: buffer.toString('base64') })
      caminhosTempParaApagar.push(arquivoInfo.caminhoStorageTemp)
    }

    if (anexos.length === 0) {
      falhas.push({
        clienteId: grupo.clienteId,
        nomeCliente: cliente.nome_empresa,
        motivo: 'Nenhum arquivo pôde ser lido do Storage.',
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
      // NÃO apaga os temporários — se o e-mail falhou, o reenvio desse
      // cliente precisa achar os mesmos arquivos de novo, sem o admin ter
      // que re-anexar nada (pedido explícito).
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
      // Mesmo motivo do caso acima — mantém os temporários pro reenvio.
      falhas.push({
        clienteId: grupo.clienteId,
        nomeCliente: cliente.nome_empresa,
        motivo: 'E-mail enviado, mas houve um erro ao registrar os documentos.',
      })
      return
    }

    emailsEnviados += 1

    // Só chega aqui quando o cliente inteiro deu certo (e-mail enviado E
    // documentos_clientes gravado) — aí sim os temporários não servem pra
    // mais nada, e são apagados. Falha em apagar não derruba o envio, que
    // já está confirmado; só sobra lixo no prefixo temporário.
    const { error: removeError } = await supabaseAdmin.storage.from(BUCKET_DOCUMENTOS).remove(caminhosTempParaApagar)
    if (removeError) {
      console.error('[envio-mensal] Falha ao limpar arquivos temporários (não bloqueia o envio):', removeError)
    }
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

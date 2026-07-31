import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SEGMENTOS } from '@/lib/constants/segmentos'

export const dynamic = 'force-dynamic'

// Delay entre chamadas à BrasilAPI (gratuita e sem autenticação) pra não
// sobrecarregá-la quando o front processa vários clientes em sequência.
const DELAY_ENTRE_CHAMADAS_MS = 300

// Fallback quando o CNAE não bate com nenhuma palavra-chave conhecida —
// último item da lista oficial de segmentos ("Outros").
const SEGMENTO_PADRAO = SEGMENTOS[SEGMENTOS.length - 1]

// Cada entrada é checada em ordem — categorias mais específicas vêm antes
// das genéricas (ex: "vestuário" antes de "comércio varejista") pra evitar
// que um CNAE de loja de roupas caia em "Comércio" em vez de "Moda e
// Vestuário". A primeira que bater com alguma palavra-chave vence.
const MAPA_SEGMENTO_POR_PALAVRA_CHAVE: { palavras: string[]; segmento: string }[] = [
  {
    palavras: ['medic', 'clinic', 'saude', 'odontol', 'hospital', 'laborator', 'fisioterap', 'psicolog', 'veterinari'],
    segmento: 'Saúde/Clínica Médica',
  },
  { palavras: ['advocacia', 'advogad', 'juridic'], segmento: 'Advocacia/Consultoria' },
  { palavras: ['contabil', 'contabilidade', 'auditoria fiscal'], segmento: 'Contabilidade' },
  {
    palavras: [
      'tecnologia da informacao',
      'desenvolvimento de sistemas',
      'desenvolvimento de programas',
      'software',
      'programacao',
      'informatica',
    ],
    segmento: 'Tecnologia',
  },
  {
    palavras: ['cabeleireiro', 'salao de beleza', 'barbearia', 'manicure', 'estetica', 'beleza'],
    segmento: 'Beleza e Estética',
  },
  { palavras: ['organizacao de festas', 'buffet', 'eventos', 'cerimonial'], segmento: 'Eventos' },
  { palavras: ['educacao', 'ensino', 'escola', 'creche', 'curso'], segmento: 'Educação' },
  { palavras: ['imobiliari', 'imoveis', 'incorporacao'], segmento: 'Imobiliário' },
  { palavras: ['agropecuari', 'agricola', 'agronegocio', 'pecuaria', 'cultivo'], segmento: 'Agronegócio' },
  { palavras: ['transporte', 'transportadora', 'logistica', 'frete'], segmento: 'Transporte e Logística' },
  { palavras: ['construcao', 'obras', 'engenharia civil', 'reforma'], segmento: 'Construção Civil' },
  { palavras: ['vestuario', 'confeccao de roupas', 'roupas', 'moda'], segmento: 'Moda e Vestuário' },
  {
    palavras: ['restaurante', 'lanchonete', 'alimenticio', 'alimentacao', 'padaria', 'confeitaria', 'bares'],
    segmento: 'Alimentação',
  },
  { palavras: ['industria', 'fabricacao', 'fabrica de'], segmento: 'Indústria' },
  { palavras: ['comercio varejista', 'comercio atacadista', 'comercio de'], segmento: 'Comércio' },
  { palavras: ['servico'], segmento: 'Serviços' },
]

function normalizarTexto(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

// Mapeia a descrição do CNAE principal (ex: "Comércio varejista de
// medicamentos") pra uma das opções de segmento já existentes no projeto.
// Não tem como ter 100% de confiança nesse tipo de heurística por
// palavra-chave, então qualquer descrição que não bata com nada conhecido
// cai no fallback "Outros" em vez de arriscar uma categoria errada.
function mapearSegmento(descricaoCnae: string): string {
  const normalizado = normalizarTexto(descricaoCnae)
  const encontrado = MAPA_SEGMENTO_POR_PALAVRA_CHAVE.find((item) =>
    item.palavras.some((palavra) => normalizado.includes(normalizarTexto(palavra)))
  )
  return encontrado?.segmento ?? SEGMENTO_PADRAO
}

type ClienteRow = {
  id: string
  cnpj_cpf: string | null
  tipo: string
  regime_tributario: string | null
  segmento: string | null
}

type DadosReceitaCnpj = {
  opcao_pelo_mei?: boolean | null
  opcao_pelo_simples?: boolean | null
  cnae_fiscal_descricao?: string | null
}

type ResultadoVerificacao = {
  cliente_id: string
  resultado: 'mei' | 'simples_nacional' | 'manual' | 'erro'
  motivo?: string
  segmentoAtualizado?: boolean
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extrairClienteIds(body: unknown): string[] | null {
  if (!body || typeof body !== 'object') return null
  const objeto = body as Record<string, unknown>

  if (typeof objeto.cliente_id === 'string' && objeto.cliente_id) {
    return [objeto.cliente_id]
  }

  if (
    Array.isArray(objeto.cliente_ids) &&
    objeto.cliente_ids.length > 0 &&
    objeto.cliente_ids.every((item) => typeof item === 'string' && item)
  ) {
    return objeto.cliente_ids as string[]
  }

  return null
}

// Verifica um cliente por vez: busca o CNPJ salvo, consulta a BrasilAPI e
// atualiza tipo/regime_tributario conforme o que a Receita informa. Qualquer
// falha (cliente sem CNPJ válido, rede fora do ar, CNPJ não encontrado)
// vira um resultado "erro" com motivo, sem lançar exceção — assim um cliente
// problemático não trava o processamento dos demais da lista.
async function verificarCliente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clienteId: string
): Promise<ResultadoVerificacao> {
  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('id, cnpj_cpf, tipo, regime_tributario, segmento')
    .eq('id', clienteId)
    .single<ClienteRow>()

  if (clienteError || !cliente) {
    return { cliente_id: clienteId, resultado: 'erro', motivo: 'Cliente não encontrado.' }
  }

  const digitos = (cliente.cnpj_cpf ?? '').replace(/\D/g, '')

  if (digitos.length !== 14) {
    return {
      cliente_id: clienteId,
      resultado: 'erro',
      motivo: 'Sem CNPJ válido cadastrado (cliente pode ser pessoa física/CPF).',
    }
  }

  let dadosReceita: DadosReceitaCnpj

  try {
    // A BrasilAPI recusa com 403 requisições sem User-Agent, mesmo sendo um
    // endpoint público sem autenticação — é uma proteção deles contra
    // tráfego não identificado, não algo específico da nossa integração.
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`, {
      headers: {
        'User-Agent': 'OpcaoContabilSistema/1.0',
      },
    })

    if (!resposta.ok) {
      return {
        cliente_id: clienteId,
        resultado: 'erro',
        motivo: `CNPJ não encontrado na Receita (HTTP ${resposta.status}).`,
      }
    }

    dadosReceita = await resposta.json()
  } catch {
    return { cliente_id: clienteId, resultado: 'erro', motivo: 'Falha de rede ao consultar a BrasilAPI.' }
  }

  // Segmento só entra na atualização se o cliente ainda não tiver um
  // cadastrado (nunca sobrescreve o que o admin já preencheu à mão) e a
  // BrasilAPI tiver retornado a descrição do CNAE principal.
  const segmentoSugerido =
    !cliente.segmento && dadosReceita.cnae_fiscal_descricao
      ? mapearSegmento(dadosReceita.cnae_fiscal_descricao)
      : null

  if (dadosReceita.opcao_pelo_mei === true) {
    const atualizacao: Record<string, unknown> = { tipo: 'mei' }
    if (segmentoSugerido) atualizacao.segmento = segmentoSugerido

    const { error: updateError } = await supabase.from('clientes').update(atualizacao).eq('id', clienteId)

    if (updateError) {
      return { cliente_id: clienteId, resultado: 'erro', motivo: 'Identificado como MEI, mas falhou ao salvar.' }
    }

    return { cliente_id: clienteId, resultado: 'mei', segmentoAtualizado: !!segmentoSugerido }
  }

  if (dadosReceita.opcao_pelo_simples === true) {
    const atualizacao: Record<string, unknown> = { regime_tributario: 'simples_nacional' }
    if (segmentoSugerido) atualizacao.segmento = segmentoSugerido

    const { error: updateError } = await supabase.from('clientes').update(atualizacao).eq('id', clienteId)

    if (updateError) {
      return {
        cliente_id: clienteId,
        resultado: 'erro',
        motivo: 'Identificado como Simples Nacional, mas falhou ao salvar.',
      }
    }

    return { cliente_id: clienteId, resultado: 'simples_nacional', segmentoAtualizado: !!segmentoSugerido }
  }

  // Não é MEI nem Simples — a BrasilAPI não distingue Lucro Presumido de
  // Lucro Real, então não adivinha o regime tributário: mantém
  // regime_tributario como está e sinaliza que precisa de conferência
  // manual. O segmento sugerido ainda é salvo, se houver um.
  if (segmentoSugerido) {
    const { error: updateError } = await supabase
      .from('clientes')
      .update({ segmento: segmentoSugerido })
      .eq('id', clienteId)

    if (updateError) {
      return {
        cliente_id: clienteId,
        resultado: 'manual',
        motivo:
          'Não é MEI nem Simples Nacional — confirme manualmente entre Lucro Presumido/Lucro Real. O segmento sugerido não pôde ser salvo.',
      }
    }
  }

  return {
    cliente_id: clienteId,
    resultado: 'manual',
    motivo: 'Não é MEI nem Simples Nacional — confirme manualmente entre Lucro Presumido/Lucro Real.',
    segmentoAtualizado: !!segmentoSugerido,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const clienteIds = extrairClienteIds(body)

  if (!clienteIds) {
    return NextResponse.json({ error: 'Informe cliente_id ou cliente_ids.' }, { status: 400 })
  }

  const detalhes: ResultadoVerificacao[] = []

  for (const clienteId of clienteIds) {
    try {
      detalhes.push(await verificarCliente(supabase, clienteId))
    } catch {
      detalhes.push({ cliente_id: clienteId, resultado: 'erro', motivo: 'Erro inesperado ao processar.' })
    }

    await esperar(DELAY_ENTRE_CHAMADAS_MS)
  }

  const resumo = {
    mei: detalhes.filter((item) => item.resultado === 'mei').length,
    simples_nacional: detalhes.filter((item) => item.resultado === 'simples_nacional').length,
    manual: detalhes.filter((item) => item.resultado === 'manual').length,
    falhas: detalhes.filter((item) => item.resultado === 'erro').length,
    segmentos_atualizados: detalhes.filter((item) => item.segmentoAtualizado).length,
  }

  return NextResponse.json({ resumo, detalhes })
}

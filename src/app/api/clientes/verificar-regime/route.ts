import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Delay entre chamadas à BrasilAPI (gratuita e sem autenticação) pra não
// sobrecarregá-la quando o front processa vários clientes em sequência.
const DELAY_ENTRE_CHAMADAS_MS = 300

type ClienteRow = {
  id: string
  cnpj_cpf: string | null
  tipo: string
  regime_tributario: string | null
}

type DadosReceitaCnpj = {
  opcao_pelo_mei?: boolean | null
  opcao_pelo_simples?: boolean | null
}

type ResultadoVerificacao = {
  cliente_id: string
  resultado: 'mei' | 'simples_nacional' | 'manual' | 'erro'
  motivo?: string
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
    .select('id, cnpj_cpf, tipo, regime_tributario')
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
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`)

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

  if (dadosReceita.opcao_pelo_mei === true) {
    const { error: updateError } = await supabase.from('clientes').update({ tipo: 'mei' }).eq('id', clienteId)

    if (updateError) {
      return { cliente_id: clienteId, resultado: 'erro', motivo: 'Identificado como MEI, mas falhou ao salvar.' }
    }

    return { cliente_id: clienteId, resultado: 'mei' }
  }

  if (dadosReceita.opcao_pelo_simples === true) {
    const { error: updateError } = await supabase
      .from('clientes')
      .update({ regime_tributario: 'simples_nacional' })
      .eq('id', clienteId)

    if (updateError) {
      return {
        cliente_id: clienteId,
        resultado: 'erro',
        motivo: 'Identificado como Simples Nacional, mas falhou ao salvar.',
      }
    }

    return { cliente_id: clienteId, resultado: 'simples_nacional' }
  }

  // Não é MEI nem Simples — a BrasilAPI não distingue Lucro Presumido de
  // Lucro Real, então não adivinha: mantém o regime_tributario como está e
  // sinaliza que precisa de conferência manual.
  return {
    cliente_id: clienteId,
    resultado: 'manual',
    motivo: 'Não é MEI nem Simples Nacional — confirme manualmente entre Lucro Presumido/Lucro Real.',
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
  }

  return NextResponse.json({ resumo, detalhes })
}

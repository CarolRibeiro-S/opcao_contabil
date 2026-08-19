import { createAdminClient } from '@/lib/supabase/admin'

type ClienteHonorario = {
  id: string
  nome_empresa: string
  honorario_valor_mensal: number
  honorario_dia_vencimento: number
}

export type ResumoGeracaoHonorarios = {
  totalGerados: number
  totalPulados: number
  gerados: { clienteId: string; nomeCliente: string }[]
}

const MENSAGEM_PADRAO_BOLETO = 'Segue seu honorário mensal para pagamento via boleto.'

// Núcleo da geração automática do honorário fixo mensal — chamado pelo cron
// (/api/cron/gerar-honorarios, protegido por CRON_SECRET). Só cria o
// registro em "cobrancas" com o valor e a data de vencimento; NÃO anexa
// boleto nem envia e-mail (isso continua manual, ver EditarCobrancaForm.tsx
// e api/cobrancas/notificar-boleto — o Hederson gera o boleto no banco dele
// e anexa depois).
//
// Idempotente: rodar de novo no mesmo dia/mês não duplica nada. A checagem
// usa cliente_id + competência + gerado_automaticamente=true — não basta
// cliente_id + competência sozinhos, porque um cliente pode ter também
// cobranças avulsas manuais na mesma competência (ex: "Emissão de NF
// avulsa"), e essas não podem contar como "já gerado" e bloquear o
// honorário automático de nascer.
export async function gerarHonorariosAutomaticos(): Promise<ResumoGeracaoHonorarios> {
  const supabase = createAdminClient()

  const agora = new Date()
  const ano = agora.getUTCFullYear()
  const mes = agora.getUTCMonth() + 1
  const competencia = `${ano}-${String(mes).padStart(2, '0')}-01`
  const mesFormatado = `${String(mes).padStart(2, '0')}/${ano}`

  // Último dia real do mês (28-31) — usado pra "encaixar" o dia de
  // vencimento configurado quando ele não existe no mês corrente (ex: dia
  // 31 configurado, mas o mês tem só 30 dias, ou é fevereiro).
  const ultimoDiaDoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate()

  const { data: clientes, error: clientesError } = await supabase
    .from('clientes')
    .select('id, nome_empresa, honorario_valor_mensal, honorario_dia_vencimento')
    .eq('status', 'ativo')
    .not('honorario_valor_mensal', 'is', null)
    .not('honorario_dia_vencimento', 'is', null)
    .returns<ClienteHonorario[]>()

  if (clientesError) {
    throw new Error(`Falha ao buscar clientes: ${clientesError.message}`)
  }

  const gerados: { clienteId: string; nomeCliente: string }[] = []
  let totalPulados = 0

  for (const cliente of clientes ?? []) {
    const { data: existente } = await supabase
      .from('cobrancas')
      .select('id')
      .eq('cliente_id', cliente.id)
      .eq('competencia', competencia)
      .eq('gerado_automaticamente', true)
      .maybeSingle()

    if (existente) {
      totalPulados += 1
      continue
    }

    const dia = Math.min(cliente.honorario_dia_vencimento, ultimoDiaDoMes)
    const dataVencimento = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

    const { error: insertError } = await supabase.from('cobrancas').insert({
      cliente_id: cliente.id,
      descricao: `Honorário mensal - ${mesFormatado}`,
      competencia,
      valor: cliente.honorario_valor_mensal,
      data_vencimento: dataVencimento,
      status: 'em_aberto',
      // Pré-marcado como 'boleto' porque é sempre assim que o Hederson
      // entrega — poupa ele de escolher isso toda vez que for anexar.
      forma_pagamento: 'boleto',
      mensagem_pagamento: MENSAGEM_PADRAO_BOLETO,
      gerado_automaticamente: true,
    })

    if (insertError) {
      console.error('[gerarHonorariosAutomaticos] Erro ao inserir honorário:', insertError)
      continue
    }

    gerados.push({ clienteId: cliente.id, nomeCliente: cliente.nome_empresa })
  }

  return { totalGerados: gerados.length, totalPulados, gerados }
}

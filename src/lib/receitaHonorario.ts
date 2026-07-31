import type { createClient } from '@/lib/supabase/client'

type SupabaseNavegador = ReturnType<typeof createClient>

const NOME_CATEGORIA_HONORARIOS = 'Honorários Contábeis'

type CobrancaComCliente = {
  id: string
  valor: number | null
  competencia: string | null
  data_pagamento: string | null
  clientes: { nome_empresa: string } | null
}

async function obterCategoriaHonorarios(supabase: SupabaseNavegador): Promise<string | null> {
  const { data: existente } = await supabase
    .from('categorias_financeiras')
    .select('id')
    .eq('nome', NOME_CATEGORIA_HONORARIOS)
    .maybeSingle()

  if (existente) return existente.id

  // Categoria "Honorários Contábeis" ainda não existe em categorias_financeiras
  // (o admin pode não ter cadastrado as categorias de receita ainda) — cria
  // na hora pra não deixar a sincronização travada por causa disso.
  const { data: criada, error } = await supabase
    .from('categorias_financeiras')
    .insert({ nome: NOME_CATEGORIA_HONORARIOS, tipo: 'receita' })
    .select('id')
    .single()

  if (error || !criada) {
    console.error('Não foi possível criar/localizar a categoria "Honorários Contábeis":', error)
    return null
  }

  return criada.id
}

/**
 * Chamado depois que um honorário (cobrancas) é marcado como pago. Cria a
 * receita espelhada se ainda não existir (por honorario_id) ou só atualiza
 * os campos relevantes se já existir — evita duplicar em caso de
 * marcar/reverter/marcar de novo.
 */
export async function sincronizarReceitaDoHonorario(supabase: SupabaseNavegador, cobrancaId: string) {
  const { data: cobranca } = await supabase
    .from('cobrancas')
    .select('id, valor, competencia, data_pagamento, clientes(nome_empresa)')
    .eq('id', cobrancaId)
    .single<CobrancaComCliente>()

  if (!cobranca) return

  const categoriaId = await obterCategoriaHonorarios(supabase)

  const { data: receitaExistente } = await supabase
    .from('receitas')
    .select('id')
    .eq('honorario_id', cobrancaId)
    .maybeSingle()

  const dadosReceita = {
    descricao: `Honorário — ${cobranca.clientes?.nome_empresa ?? 'Cliente'}`,
    categoria_id: categoriaId,
    valor: cobranca.valor,
    competencia: cobranca.competencia,
    data_recebimento: cobranca.data_pagamento,
    status: 'recebido',
    origem: 'honorario',
    honorario_id: cobranca.id,
  }

  if (receitaExistente) {
    await supabase.from('receitas').update(dadosReceita).eq('id', receitaExistente.id)
  } else {
    await supabase.from('receitas').insert(dadosReceita)
  }
}

/**
 * Chamado quando o pagamento de um honorário é revertido — reverte a
 * receita espelhada em vez de excluí-la, mantendo o histórico.
 */
export async function reverterReceitaDoHonorario(supabase: SupabaseNavegador, cobrancaId: string) {
  await supabase
    .from('receitas')
    .update({ status: 'a_receber', data_recebimento: null })
    .eq('honorario_id', cobrancaId)
}

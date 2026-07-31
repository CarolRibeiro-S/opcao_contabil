import { createAdminClient } from '@/lib/supabase/admin'

// Cobre Clientes, Tarefas, Prazos, Honorários, Despesas, Receitas,
// Comunicados e Equipe. As ações abaixo espelham a constraint já existente
// na coluna historico_atividades.acao.
export type AcaoHistorico =
  | 'criou'
  | 'editou'
  | 'ativou'
  | 'inativou'
  | 'excluiu'
  | 'anexou_documento'
  | 'enviou_comunicado'
  | 'moveu_prazo'
  | 'marcou_pago'
  | 'reverteu_pagamento'
  | 'convidou'

export type EntidadeHistorico =
  | 'cliente'
  | 'tarefa'
  | 'prazo'
  | 'honorario'
  | 'despesa'
  | 'receita'
  | 'comunicado'
  | 'membro_equipe'

export const ACOES_HISTORICO: AcaoHistorico[] = [
  'criou',
  'editou',
  'ativou',
  'inativou',
  'excluiu',
  'anexou_documento',
  'enviou_comunicado',
  'moveu_prazo',
  'marcou_pago',
  'reverteu_pagamento',
  'convidou',
]

export const ENTIDADES_HISTORICO: EntidadeHistorico[] = [
  'cliente',
  'tarefa',
  'prazo',
  'honorario',
  'despesa',
  'receita',
  'comunicado',
  'membro_equipe',
]

type RegistrarHistoricoParams = {
  usuarioId: string
  usuarioNome: string
  acao: AcaoHistorico
  entidade: EntidadeHistorico
  entidadeId: string
  entidadeNome: string
  detalhes?: string | null
}

/**
 * Só deve ser chamada a partir de Route Handlers/Server Actions (usa a
 * service role). Nunca importe este módulo em um arquivo 'use client'.
 * Falha ao gravar o log não deve derrubar a ação principal, que já foi
 * concluída no banco antes desta chamada — por isso só loga o erro.
 */
export async function registrarHistorico({
  usuarioId,
  usuarioNome,
  acao,
  entidade,
  entidadeId,
  entidadeNome,
  detalhes,
}: RegistrarHistoricoParams) {
  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin.from('historico_atividades').insert({
    usuario_id: usuarioId,
    usuario_nome: usuarioNome,
    acao,
    entidade,
    entidade_id: entidadeId,
    entidade_nome: entidadeNome,
    detalhes: detalhes ?? null,
  })

  if (error) {
    console.error('Falha ao registrar histórico de atividade:', error.message)
  }
}

import { createAdminClient } from '@/lib/supabase/admin'

// Cobre só Clientes nesta primeira etapa. Outros módulos (Tarefas, Prazos,
// Honorários, Documentos, Comunicados, Equipe) entram aqui conforme forem
// instrumentados nas próximas etapas.
export type AcaoHistorico = 'criou' | 'editou' | 'ativou' | 'inativou' | 'excluiu'
export type EntidadeHistorico = 'cliente'

export const ACOES_HISTORICO: AcaoHistorico[] = ['criou', 'editou', 'ativou', 'inativou', 'excluiu']
export const ENTIDADES_HISTORICO: EntidadeHistorico[] = ['cliente']

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

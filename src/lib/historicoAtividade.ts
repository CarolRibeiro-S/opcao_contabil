import type { AcaoHistorico, EntidadeHistorico } from './historico'

/**
 * Chamado a partir de componentes 'use client' depois que a ação principal
 * já foi concluída com sucesso no banco. Só faz a requisição HTTP — quem
 * efetivamente grava no banco é a rota /api/historico/registrar, que chama
 * registrarHistorico() no servidor. Falha aqui é engolida de propósito: não
 * deve travar nem mostrar erro pra uma ação que já terminou.
 *
 * Usado por qualquer módulo cuja mutação acontece direto no client (via
 * supabase.from(...).insert/update/delete) — Clientes, Tarefas, Prazos,
 * Honorários, Despesas, Receitas e Comunicados. Módulos cuja mutação já
 * passa por um Route Handler (Equipe) chamam registrarHistorico() direto no
 * servidor, sem precisar desse wrapper.
 */
export async function registrarHistoricoAtividade(payload: {
  acao: AcaoHistorico
  entidade: EntidadeHistorico
  entidadeId: string
  entidadeNome: string
  detalhes?: string
}) {
  try {
    await fetch('/api/historico/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Sem tratamento — ver comentário acima.
  }
}

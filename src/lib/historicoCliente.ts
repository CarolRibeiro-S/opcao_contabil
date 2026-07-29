import type { AcaoHistorico, EntidadeHistorico } from './historico'

/**
 * Chamado a partir de componentes 'use client' depois que a ação principal
 * já foi concluída com sucesso no banco. Só faz a requisição HTTP — quem
 * efetivamente grava no banco é a rota /api/historico/registrar, que chama
 * registrarHistorico() no servidor. Falha aqui é engolida de propósito: não
 * deve travar nem mostrar erro pra uma ação que já terminou.
 */
export async function registrarHistoricoCliente(payload: {
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

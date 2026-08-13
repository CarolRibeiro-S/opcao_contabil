'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Versão "em lote" do padrão de PagamentoCobranca.tsx: em vez de marcar um
// item específico (que já sabe se está null ou não antes de montar), essa
// aqui cobre telas que listam VÁRIOS itens de uma vez (Documentos,
// Solicitação Mensal) — ao montar, marca como visualizado_pelo_cliente_em =
// now() tudo que ainda estiver null pra esse cliente naquela tabela, num
// update só. Não renderiza nada; só dispara o efeito.
export default function MarcarVisualizado({
  tabela,
  clienteId,
}: {
  tabela: 'documentos_clientes' | 'envios_solicitacao_mensal'
  clienteId: string
}) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function marcar() {
      const { data, error } = await supabase
        .from(tabela)
        .update({ visualizado_pelo_cliente_em: new Date().toISOString() })
        .eq('cliente_id', clienteId)
        .is('visualizado_pelo_cliente_em', null)
        .select('id')

      if (error) {
        console.error(`[MarcarVisualizado] Erro ao marcar "${tabela}" como visualizado:`, error)
        return
      }

      // Só recarrega se algo realmente mudou — evita um refresh inútil toda
      // vez que a página é revisitada depois que tudo já foi visto.
      if (data && data.length > 0) {
        router.refresh()
      }
    }

    marcar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabela, clienteId])

  return null
}

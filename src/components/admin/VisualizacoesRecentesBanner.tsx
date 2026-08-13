'use client'

import { useState, type ReactNode } from 'react'
import { IconOlho } from '@/components/shared/icons'

export type ItemVisualizacaoRecente = { id: string; texto: ReactNode }

// Generalização de VisualizacoesHonorariosBanner (nome antigo, só cobria
// honorários) — mesmo comportamento: "×" descarta só localmente (estado do
// componente, some ao recarregar a página). Não existe um "admin já viu
// isso" persistido pra nenhuma dessas 4 fontes (diferente de comunicados,
// que tem visto_em/status pra outra finalidade), então não há nada pra
// gravar no banco aqui — é só um aviso de leitura recente.
export default function VisualizacoesRecentesBanner({ itens }: { itens: ItemVisualizacaoRecente[] }) {
  const [descartados, setDescartados] = useState<Set<string>>(new Set())

  const visiveis = itens.filter((item) => !descartados.has(item.id))

  if (visiveis.length === 0) return null

  function descartar(id: string) {
    setDescartados((atual) => new Set(atual).add(id))
  }

  return (
    <div className="mb-6 flex flex-col gap-2">
      {visiveis.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
        >
          <div className="flex items-center gap-2.5">
            <IconOlho className="h-5 w-5 shrink-0 text-blue-600" />
            <p className="text-sm text-blue-800">{item.texto}</p>
          </div>
          <button
            type="button"
            onClick={() => descartar(item.id)}
            aria-label="Dispensar aviso"
            className="shrink-0 text-lg leading-none text-blue-600 transition-colors duration-200 hover:text-blue-900"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

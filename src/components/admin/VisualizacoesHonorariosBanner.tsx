'use client'

import { useState } from 'react'

type ItemVisualizacao = { id: string; nomeCliente: string; competencia: string }

function IconOlho({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1.7 10S4.5 4.2 10 4.2 18.3 10 18.3 10 15.5 15.8 10 15.8 1.7 10 1.7 10Z" />
      <circle cx="10" cy="10" r="2.3" />
    </svg>
  )
}

// Não existe (nem faz sentido criar só pra isso) um campo "admin já viu essa
// notificação" pra honorários, ao contrário de comunicados (visto_em) — por
// isso o "descartar" aqui é só local (estado do componente, reseta ao
// recarregar a página), não grava nada no banco.
export default function VisualizacoesHonorariosBanner({ itens }: { itens: ItemVisualizacao[] }) {
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
            <p className="text-sm text-blue-800">
              <strong>{item.nomeCliente}</strong> visualizou o honorário de <strong>{item.competencia}</strong>
            </p>
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

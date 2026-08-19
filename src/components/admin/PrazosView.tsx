'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PrazosKanban from './PrazosKanban'
import PrazosCalendario from './PrazosCalendario'

type Prazo = {
  id: string
  competencia: string | null
  data_vencimento: string | null
  status: string
  comprovante_url: string | null
  entregue_em: string | null
  clientes: { nome_empresa: string } | null
  obrigacoes_acessorias: { nome: string } | null
}

export default function PrazosView({ prazos }: { prazos: Prazo[] }) {
  const searchParams = useSearchParams()
  const visaoInicial = searchParams.get('visao') === 'calendario' ? 'calendario' : 'kanban'
  const [visao, setVisao] = useState<'kanban' | 'calendario'>(visaoInicial)

  return (
    <div>
      <div className="mb-6 inline-flex rounded-[3px] border border-rule bg-white p-1">
        <button
          type="button"
          onClick={() => setVisao('kanban')}
          className={`rounded-[3px] px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
            visao === 'kanban' ? 'bg-navy text-paper' : 'text-navy-soft hover:text-navy'
          }`}
        >
          Kanban
        </button>
        <button
          type="button"
          onClick={() => setVisao('calendario')}
          className={`rounded-[3px] px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
            visao === 'calendario' ? 'bg-navy text-paper' : 'text-navy-soft hover:text-navy'
          }`}
        >
          Calendário
        </button>
      </div>

      {visao === 'kanban' ? <PrazosKanban prazos={prazos} /> : <PrazosCalendario prazos={prazos} />}
    </div>
  )
}

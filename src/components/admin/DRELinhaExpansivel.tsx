'use client'

import { useState } from 'react'
import Link from 'next/link'
import { IconChevron } from '@/components/shared/icons'

export type LancamentoDRE = {
  id: string
  descricao: string
  valor: number
  dataVencimento: string | null
  dataSecundaria: string | null
  observacao: string | null
  editarHref: string
}

type DRELinhaExpansivelProps = {
  nome: string
  total: number
  lancamentos: LancamentoDRE[]
  badgeClasses: string
  labelDataSecundaria: string
}

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function DRELinhaExpansivel({
  nome,
  total,
  lancamentos,
  badgeClasses,
  labelDataSecundaria,
}: DRELinhaExpansivelProps) {
  const [aberto, setAberto] = useState(false)
  const temLancamentos = lancamentos.length > 0

  return (
    <li>
      <button
        type="button"
        onClick={() => temLancamentos && setAberto((atual) => !atual)}
        disabled={!temLancamentos}
        className={`flex w-full items-center justify-between gap-3 py-2.5 pl-1 text-left text-sm ${
          temLancamentos ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <IconChevron
            className={`h-3.5 w-3.5 shrink-0 text-navy-soft transition-transform duration-200 ${
              aberto ? 'rotate-90' : ''
            } ${temLancamentos ? '' : 'opacity-0'}`}
          />
          <span className={`truncate rounded-full px-2.5 py-0.5 text-xs ${badgeClasses}`}>{nome}</span>
        </span>
        <span className="font-mono text-charcoal">{formatarValor(total)}</span>
      </button>

      {aberto && temLancamentos && (
        <ul className="ml-2 mb-2 divide-y divide-rule border-l border-rule pl-4">
          {lancamentos.map((lancamento) => (
            <li key={lancamento.id} className="py-2 text-xs text-navy-soft">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-charcoal">{lancamento.descricao}</span>
                <span className="font-mono text-charcoal">{formatarValor(lancamento.valor)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span>Vencimento: {formatarData(lancamento.dataVencimento)}</span>
                <span>
                  {labelDataSecundaria}: {formatarData(lancamento.dataSecundaria)}
                </span>
                {lancamento.observacao && <span>Obs: {lancamento.observacao}</span>}
                <Link
                  href={lancamento.editarHref}
                  className="font-semibold text-navy underline underline-offset-2"
                >
                  Editar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

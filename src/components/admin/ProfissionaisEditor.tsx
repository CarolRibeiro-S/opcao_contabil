'use client'

import { useState } from 'react'

export default function ProfissionaisEditor({
  profissionais,
  onChange,
}: {
  profissionais: string[]
  onChange: (next: string[]) => void
}) {
  const [novoProfissional, setNovoProfissional] = useState('')

  function adicionar() {
    const nome = novoProfissional.trim()
    if (!nome) return
    onChange([...profissionais, nome])
    setNovoProfissional('')
  }

  function remover(index: number) {
    onChange(profissionais.filter((_, i) => i !== index))
  }

  return (
    <div className="rounded-lg border border-rule bg-paper-dim p-4">
      <p className="mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft">
        Profissionais
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nome do profissional"
          value={novoProfissional}
          onChange={(e) => setNovoProfissional(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              adicionar()
            }
          }}
          className="w-full rounded-[3px] border border-rule bg-white px-3 py-2 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime"
        />
        <button
          type="button"
          onClick={adicionar}
          className="shrink-0 rounded-[3px] border-[1.3px] border-navy px-4 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper"
        >
          + adicionar profissional
        </button>
      </div>

      {profissionais.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {profissionais.map((nome, index) => (
            <li
              key={`${nome}-${index}`}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm text-charcoal"
            >
              {nome}
              <button
                type="button"
                onClick={() => remover(index)}
                className="text-xs font-semibold text-navy-soft hover:text-red-600"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

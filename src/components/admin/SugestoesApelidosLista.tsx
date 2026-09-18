'use client'

import { useState } from 'react'
import type { SugestaoApelido } from '@/lib/sugestaoApelidos'

const inputClasses =
  'w-full rounded-[3px] border border-rule bg-white px-2.5 py-1.5 text-sm text-charcoal outline-none transition-colors duration-200 focus:border-lime'

type SugestaoComId = SugestaoApelido & { id: string }

function CardSugestao({ sugestao, onResolvida }: { sugestao: SugestaoComId; onResolvida: (id: string) => void }) {
  const [texto, setTexto] = useState(sugestao.frase)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function aprovar() {
    const fraseFinal = texto.trim()
    if (!fraseFinal) {
      setErro('Digite alguma coisa antes de aprovar.')
      return
    }

    setErro('')
    setLoading(true)

    const resposta = await fetch('/api/clientes/salvar-apelido-extra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: sugestao.clienteId, frase: fraseFinal }),
    })

    const dados = await resposta.json().catch(() => null)
    setLoading(false)

    if (!resposta.ok) {
      setErro(dados?.error ?? 'Não foi possível salvar. Tente novamente.')
      return
    }

    setSucesso(true)
  }

  if (sucesso) {
    return (
      <div className="rounded-lg border border-success-border bg-success-bg px-4 py-3 text-sm text-success">
        Apelido extra <strong>&quot;{texto.trim()}&quot;</strong> salvo pra {sugestao.nomeEmpresa}.
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg border p-4 ${
        sugestao.conflita ? 'border-amber-300 bg-amber-50' : 'border-rule bg-white'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-sm font-semibold text-navy">{sugestao.nomeEmpresa}</p>
        <span className="font-mono text-[11px] text-navy-soft">
          apareceu em {sugestao.frequencia} de {sugestao.totalArquivos} arquivo(s) do histórico
        </span>
      </div>

      {sugestao.conflita && (
        <p className="mb-2 text-xs text-amber-800">
          ⚠ Essa frase também bateria em: <strong>{sugestao.conflitaCom.map((c) => c.nome).join(', ')}</strong>.
          Edite pra algo mais específico antes de aprovar (ex: incluir mais uma palavra do nome).
        </p>
      )}

      <p className="mb-2 text-xs text-navy-soft">
        Exemplo{sugestao.exemplos.length > 1 ? 's' : ''} real{sugestao.exemplos.length > 1 ? 'is' : ''} do
        histórico: <span className="text-charcoal">{sugestao.exemplos.join(' · ')}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className={`${inputClasses} max-w-xs flex-1`}
          aria-label={`Apelido extra sugerido para ${sugestao.nomeEmpresa}`}
        />
        <button
          type="button"
          onClick={aprovar}
          disabled={loading}
          className="rounded-[3px] bg-lime px-4 py-1.5 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Aprovar'}
        </button>
        <button
          type="button"
          onClick={() => onResolvida(sugestao.id)}
          disabled={loading}
          className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
        >
          Dispensar
        </button>
      </div>

      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
    </div>
  )
}

export default function SugestoesApelidosLista({ sugestoes }: { sugestoes: SugestaoApelido[] }) {
  const [dispensadas, setDispensadas] = useState<Set<string>>(new Set())

  const comId: SugestaoComId[] = sugestoes.map((sugestao, indice) => ({
    ...sugestao,
    id: `${sugestao.clienteId}-${indice}`,
  }))

  const visiveis = comId.filter((sugestao) => !dispensadas.has(sugestao.id))

  if (visiveis.length === 0) {
    return <p className="text-sm text-navy-soft">Nenhuma sugestão restante — todas foram aprovadas ou dispensadas.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {visiveis.map((sugestao) => (
        <CardSugestao
          key={sugestao.id}
          sugestao={sugestao}
          onResolvida={(id) => setDispensadas((atual) => new Set(atual).add(id))}
        />
      ))}
    </div>
  )
}

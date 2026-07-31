'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type AdicionarCategoriaDREProps = {
  tipo: 'despesa' | 'receita'
}

// Insere direto em categorias_financeiras e usa router.refresh() pra
// recarregar os dados do Server Component pai (DrePage) — é assim que a
// categoria nova aparece na lista logo em seguida, já com R$ 0,00, sem
// precisar navegar pra outra tela.
export default function AdicionarCategoriaDRE({ tipo }: AdicionarCategoriaDREProps) {
  const router = useRouter()
  const supabase = createClient()

  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [error, setError] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const nomeAparado = nome.trim()
    if (!nomeAparado) return

    setSalvando(true)

    const { error: insertError } = await supabase
      .from('categorias_financeiras')
      .insert({ nome: nomeAparado, tipo })

    if (insertError) {
      console.error('Erro ao criar categoria:', insertError)
      setError(insertError.message)
      setSalvando(false)
      return
    }

    setNome('')
    setAberto(false)
    setSalvando(false)
    router.refresh()
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-1 text-xs font-semibold text-navy-soft underline decoration-rule underline-offset-2 transition-colors duration-200 hover:text-navy hover:decoration-navy"
      >
        + Adicionar categoria
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 flex flex-wrap items-center gap-2">
      <input
        type="text"
        autoFocus
        required
        placeholder="Nome da categoria"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="rounded-[3px] border border-rule bg-white px-2.5 py-1 text-xs text-charcoal outline-none focus:border-lime"
      />
      <button
        type="submit"
        disabled={salvando}
        className="rounded-[3px] bg-lime px-3 py-1 text-xs font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright disabled:opacity-60"
      >
        {salvando ? 'Salvando...' : 'Salvar'}
      </button>
      <button
        type="button"
        onClick={() => {
          setAberto(false)
          setNome('')
          setError('')
        }}
        className="text-xs text-navy-soft transition-colors duration-200 hover:text-navy"
      >
        Cancelar
      </button>
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </form>
  )
}

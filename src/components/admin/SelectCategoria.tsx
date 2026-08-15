'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Categoria = { id: string; nome: string }

export default function SelectCategoria({
  tipo,
  value,
  onChange,
  nomeInicial,
  id,
  placeholder,
  className,
}: {
  tipo: 'despesa' | 'receita'
  value: string
  onChange: (categoriaId: string) => void
  nomeInicial?: string
  id?: string
  placeholder?: string
  className?: string
}) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [busca, setBusca] = useState(nomeInicial ?? '')
  const [aberto, setAberto] = useState(false)
  const [criando, setCriando] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data } = await supabase
        .from('categorias_financeiras')
        .select('id, nome')
        .in('tipo', [tipo, 'ambos'])
        .order('nome', { ascending: true })

      setCategorias(data ?? [])
    }

    carregar()
  }, [tipo])

  useEffect(() => {
    function fecharAoClicarFora(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAberto(false)
      }
    }

    document.addEventListener('mousedown', fecharAoClicarFora)
    return () => document.removeEventListener('mousedown', fecharAoClicarFora)
  }, [])

  const buscaNormalizada = busca.trim().toLowerCase()
  const categoriasFiltradas = buscaNormalizada
    ? categorias.filter((categoria) => categoria.nome.toLowerCase().includes(buscaNormalizada))
    : categorias

  const existeExata = categorias.some((categoria) => categoria.nome.toLowerCase() === buscaNormalizada)
  const mostrarCriar = buscaNormalizada.length > 0 && !existeExata

  function selecionar(categoria: Categoria) {
    onChange(categoria.id)
    setBusca(categoria.nome)
    setAberto(false)
  }

  function handleInputChange(texto: string) {
    setBusca(texto)
    setAberto(true)

    // Se o texto digitado deixou de bater com a categoria já selecionada,
    // invalida a seleção — evita submeter um categoria_id que não
    // corresponde mais ao que está escrito no campo.
    const categoriaAtual = categorias.find((categoria) => categoria.id === value)
    if (!categoriaAtual || categoriaAtual.nome !== texto) {
      onChange('')
    }
  }

  async function criarCategoria() {
    const nome = busca.trim()
    if (!nome) return

    setCriando(true)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('categorias_financeiras')
      .insert({ nome, tipo })
      .select('id, nome')
      .single()

    setCriando(false)

    if (error || !data) {
      window.alert('Não foi possível criar a categoria. Tente novamente.')
      return
    }

    setCategorias((atual) => [...atual, data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
    selecionar(data)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={busca}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setAberto(true)}
        placeholder={placeholder ?? 'Buscar ou criar categoria...'}
        autoComplete="off"
        className={className}
      />

      {aberto && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-rule bg-white py-1 shadow-lg">
          {categoriasFiltradas.map((categoria) => (
            <button
              key={categoria.id}
              type="button"
              onClick={() => selecionar(categoria)}
              className={`block w-full px-3 py-2 text-left text-sm transition-colors duration-200 hover:bg-paper-dim ${
                categoria.id === value ? 'bg-lime/10 font-medium text-navy' : 'text-charcoal'
              }`}
            >
              {categoria.nome}
            </button>
          ))}

          {categoriasFiltradas.length === 0 && !mostrarCriar && (
            <p className="px-3 py-2 text-sm text-navy-soft">Nenhuma categoria encontrada.</p>
          )}

          {mostrarCriar && (
            <button
              type="button"
              onClick={criarCategoria}
              disabled={criando}
              className="block w-full border-t border-rule px-3 py-2 text-left text-sm font-medium text-success transition-colors duration-200 hover:bg-lime/10 disabled:opacity-50"
            >
              {criando ? 'Criando...' : `+ Criar categoria "${busca.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

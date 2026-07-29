'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIAS_DESPESA } from '@/lib/constants/despesas'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

export default function NovaDespesaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_DESPESA[0].chave)
  const [valor, setValor] = useState('')
  const [competencia, setCompetencia] = useState('')
  const [dataPagamento, setDataPagamento] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Sessão expirada. Faça login novamente.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('despesas').insert({
      descricao,
      categoria,
      valor: valor ? Number(valor) : null,
      competencia: competencia ? `${competencia}-01` : null,
      data_pagamento: dataPagamento || null,
      status: dataPagamento ? 'pago' : 'em_aberto',
      criado_por: user.id,
    })

    if (insertError) {
      setError('Não foi possível salvar a despesa. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/admin/financeiro/despesas')
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/financeiro/despesas"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-navy"
      >
        ← Voltar
      </Link>

      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Nova Despesa</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="descricao" className={labelClasses}>
            Descrição
          </label>
          <input
            id="descricao"
            type="text"
            required
            placeholder="Ex: Aluguel do escritório - Julho/2026"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="categoria" className={labelClasses}>
              Categoria
            </label>
            <select
              id="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={inputClasses}
            >
              {CATEGORIAS_DESPESA.map((item) => (
                <option key={item.chave} value={item.chave}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="valor" className={labelClasses}>
              Valor
            </label>
            <input
              id="valor"
              type="number"
              step="0.01"
              min="0"
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="competencia" className={labelClasses}>
              Competência
            </label>
            <input
              id="competencia"
              type="month"
              required
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="dataPagamento" className={labelClasses}>
              Data de pagamento
            </label>
            <input
              id="dataPagamento"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className={inputClasses}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:opacity-60"
        >
          {loading ? 'Salvando...' : 'Salvar despesa'}
        </button>
      </form>
    </div>
  )
}

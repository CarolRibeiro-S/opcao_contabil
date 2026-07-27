'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SelectCliente from '@/components/admin/SelectCliente'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

export default function NovaTarefaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [clienteId, setClienteId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataLimite, setDataLimite] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error: insertError } = await supabase.from('tarefas').insert({
      cliente_id: clienteId || null,
      titulo,
      descricao: descricao || null,
      data_limite: dataLimite || null,
      status: 'a_fazer',
    })

    if (insertError) {
      setError('Não foi possível salvar a tarefa. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/admin/tarefas')
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/tarefas"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-navy"
      >
        ← Voltar
      </Link>

      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Nova Tarefa</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="cliente" className={labelClasses}>
            Cliente
          </label>
          <SelectCliente id="cliente" value={clienteId} onChange={setClienteId} />
        </div>

        <div>
          <label htmlFor="titulo" className={labelClasses}>
            Título
          </label>
          <input
            id="titulo"
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="descricao" className={labelClasses}>
            Descrição
          </label>
          <textarea
            id="descricao"
            rows={4}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </div>

        <div>
          <label htmlFor="dataLimite" className={labelClasses}>
            Data limite
          </label>
          <input
            id="dataLimite"
            type="date"
            value={dataLimite}
            onChange={(e) => setDataLimite(e.target.value)}
            className={inputClasses}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:opacity-60"
        >
          {loading ? 'Salvando...' : 'Salvar tarefa'}
        </button>
      </form>
    </div>
  )
}

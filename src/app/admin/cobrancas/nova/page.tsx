'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SelectCliente from '@/components/admin/SelectCliente'
import CampoMoeda from '@/components/shared/CampoMoeda'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

export default function NovaCobrancaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [clienteId, setClienteId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [competencia, setCompetencia] = useState('')
  const [valor, setValor] = useState<number | null>(null)
  const [dataVencimento, setDataVencimento] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error: insertError } = await supabase.from('cobrancas').insert({
      cliente_id: clienteId || null,
      descricao,
      competencia: competencia ? `${competencia}-01` : null,
      valor,
      data_vencimento: dataVencimento || null,
      status: 'em_aberto',
    })

    if (insertError) {
      setError('Não foi possível salvar o honorário. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/admin/cobrancas')
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/cobrancas"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-navy"
      >
        ← Voltar
      </Link>

      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Novo Honorário</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="cliente" className={labelClasses}>
            Cliente
          </label>
          <SelectCliente id="cliente" value={clienteId} onChange={setClienteId} required />
        </div>

        <div>
          <label htmlFor="descricao" className={labelClasses}>
            Descrição
          </label>
          <input
            id="descricao"
            type="text"
            required
            placeholder="Ex: Honorário mensal - Julho/2026, ou Emissão de NF avulsa"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className={inputClasses}
          />
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
            <label htmlFor="valor" className={labelClasses}>
              Valor
            </label>
            <CampoMoeda
              id="valor"
              required
              valor={valor}
              onChange={setValor}
              className={inputClasses}
            />
          </div>
        </div>

        <div>
          <label htmlFor="dataVencimento" className={labelClasses}>
            Data de vencimento
          </label>
          <input
            id="dataVencimento"
            type="date"
            required
            value={dataVencimento}
            onChange={(e) => setDataVencimento(e.target.value)}
            className={inputClasses}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:opacity-60"
        >
          {loading ? 'Salvando...' : 'Salvar honorário'}
        </button>
      </form>
    </div>
  )
}

'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SelectCliente from '@/components/admin/SelectCliente'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

type Obrigacao = { id: string; nome: string }

export default function NovoPrazoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [clienteId, setClienteId] = useState('')
  const [obrigacaoId, setObrigacaoId] = useState('')
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([])
  const [competencia, setCompetencia] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function carregarObrigacoes() {
      const { data } = await supabase
        .from('obrigacoes_acessorias')
        .select('id, nome')
        .order('nome', { ascending: true })

      setObrigacoes(data ?? [])
    }

    carregarObrigacoes()
  }, [supabase])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error: insertError } = await supabase.from('prazos').insert({
      cliente_id: clienteId || null,
      obrigacao_id: obrigacaoId || null,
      competencia: competencia ? `${competencia}-01` : null,
      data_vencimento: dataVencimento || null,
      observacoes: observacoes || null,
      status: 'pendente',
    })

    if (insertError) {
      setError('Não foi possível salvar o prazo. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/admin/prazos')
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/prazos"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-navy"
      >
        ← Voltar
      </Link>

      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Novo Prazo</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="cliente" className={labelClasses}>
            Cliente
          </label>
          <SelectCliente id="cliente" value={clienteId} onChange={setClienteId} required />
        </div>

        <div>
          <label htmlFor="obrigacao" className={labelClasses}>
            Obrigação acessória
          </label>
          <select
            id="obrigacao"
            value={obrigacaoId}
            onChange={(e) => setObrigacaoId(e.target.value)}
            required
            className={inputClasses}
          >
            <option value="" disabled>
              Selecione uma obrigação
            </option>
            {obrigacoes.map((obrigacao) => (
              <option key={obrigacao.id} value={obrigacao.id}>
                {obrigacao.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-5">
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
        </div>

        <div>
          <label htmlFor="observacoes" className={labelClasses}>
            Observações
          </label>
          <textarea
            id="observacoes"
            rows={4}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:opacity-60"
        >
          {loading ? 'Salvando...' : 'Salvar prazo'}
        </button>
      </form>
    </div>
  )
}

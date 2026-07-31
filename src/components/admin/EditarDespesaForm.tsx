'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SelectCategoria from '@/components/admin/SelectCategoria'
import CampoMoeda from '@/components/shared/CampoMoeda'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

export type Despesa = {
  id: string
  descricao: string
  categoria_id: string | null
  categorias_financeiras: { nome: string } | null
  valor: number | null
  competencia: string | null
  data_vencimento: string | null
  data_pagamento: string | null
  observacao: string | null
}

export default function EditarDespesaForm({ despesa }: { despesa: Despesa }) {
  const router = useRouter()
  const supabase = createClient()

  const [descricao, setDescricao] = useState(despesa.descricao)
  const [categoriaId, setCategoriaId] = useState(despesa.categoria_id ?? '')
  const [valor, setValor] = useState<number | null>(despesa.valor)
  const [competencia, setCompetencia] = useState(despesa.competencia?.slice(0, 7) ?? '')
  const [dataVencimento, setDataVencimento] = useState(despesa.data_vencimento ?? '')
  const [dataPagamento, setDataPagamento] = useState(despesa.data_pagamento ?? '')
  const [observacao, setObservacao] = useState(despesa.observacao ?? '')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!categoriaId) {
      setError('Selecione (ou crie) uma categoria.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase
      .from('despesas')
      .update({
        descricao,
        categoria_id: categoriaId,
        valor,
        competencia: competencia ? `${competencia}-01` : null,
        data_vencimento: dataVencimento || null,
        data_pagamento: dataPagamento || null,
        observacao: observacao || null,
        status: dataPagamento ? 'pago' : 'em_aberto',
      })
      .eq('id', despesa.id)

    if (updateError) {
      setError('Não foi possível salvar as alterações. Tente novamente.')
      setLoading(false)
      return
    }

    registrarHistoricoAtividade({
      acao: 'editou',
      entidade: 'despesa',
      entidadeId: despesa.id,
      entidadeNome: descricao,
    })

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

      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Editar Despesa</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="descricao" className={labelClasses}>
            Descrição
          </label>
          <input
            id="descricao"
            type="text"
            required
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
            <SelectCategoria
              id="categoria"
              tipo="despesa"
              value={categoriaId}
              onChange={setCategoriaId}
              nomeInicial={despesa.categorias_financeiras?.nome}
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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

        <div>
          <label htmlFor="observacao" className={labelClasses}>
            Observação
          </label>
          <textarea
            id="observacao"
            rows={3}
            placeholder="Ex: pago via PIX, banco X, referente à NF 1234"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:opacity-60"
        >
          {loading ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  )
}

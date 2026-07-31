'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SelectCategoria from '@/components/admin/SelectCategoria'
import CampoMoeda from '@/components/shared/CampoMoeda'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const inputDesabilitadoClasses = `${inputClasses} cursor-not-allowed opacity-60`

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

export type Receita = {
  id: string
  descricao: string
  categoria_id: string | null
  categorias_financeiras: { nome: string } | null
  valor: number | null
  competencia: string | null
  data_vencimento: string | null
  data_recebimento: string | null
  observacao: string | null
  origem: string
}

export default function EditarReceitaForm({ receita }: { receita: Receita }) {
  const router = useRouter()
  const supabase = createClient()

  const geradaPorHonorario = receita.origem === 'honorario'

  const [descricao, setDescricao] = useState(receita.descricao)
  const [categoriaId, setCategoriaId] = useState(receita.categoria_id ?? '')
  const [valor, setValor] = useState<number | null>(receita.valor)
  const [competencia, setCompetencia] = useState(receita.competencia?.slice(0, 7) ?? '')
  const [dataVencimento, setDataVencimento] = useState(receita.data_vencimento ?? '')
  const [dataRecebimento, setDataRecebimento] = useState(receita.data_recebimento ?? '')
  const [observacao, setObservacao] = useState(receita.observacao ?? '')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!geradaPorHonorario && !categoriaId) {
      setError('Selecione (ou crie) uma categoria.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase
      .from('receitas')
      .update({
        // Descrição/categoria/valor não entram aqui quando a receita veio de
        // um honorário — permanecem com o que já estava salvo, refletindo o
        // honorário original.
        ...(geradaPorHonorario
          ? {}
          : { descricao, categoria_id: categoriaId, valor }),
        competencia: competencia ? `${competencia}-01` : null,
        data_vencimento: dataVencimento || null,
        data_recebimento: dataRecebimento || null,
        observacao: observacao || null,
        status: dataRecebimento ? 'recebido' : 'a_receber',
      })
      .eq('id', receita.id)

    if (updateError) {
      setError('Não foi possível salvar as alterações. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/admin/financeiro/receitas')
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/financeiro/receitas"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-navy"
      >
        ← Voltar
      </Link>

      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">Editar Receita</h1>

      {geradaPorHonorario && (
        <p className="mb-6 rounded-lg border border-navy/15 bg-navy/5 px-3.5 py-2.5 text-sm text-navy-soft">
          Gerado automaticamente a partir de um honorário pago — edite o honorário original em{' '}
          <Link href="/admin/cobrancas" className="font-semibold text-navy underline underline-offset-2">
            Honorários Contábeis
          </Link>{' '}
          para alterar descrição, categoria ou valor.
        </p>
      )}

      <form onSubmit={handleSubmit} className={`space-y-5 ${geradaPorHonorario ? '' : 'mt-8'}`}>
        <div>
          <label htmlFor="descricao" className={labelClasses}>
            Descrição
          </label>
          <input
            id="descricao"
            type="text"
            required
            disabled={geradaPorHonorario}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className={geradaPorHonorario ? inputDesabilitadoClasses : inputClasses}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="categoria" className={labelClasses}>
              Categoria
            </label>
            {geradaPorHonorario ? (
              <input
                type="text"
                disabled
                value={receita.categorias_financeiras?.nome ?? 'Sem categoria'}
                className={inputDesabilitadoClasses}
              />
            ) : (
              <SelectCategoria
                id="categoria"
                tipo="receita"
                value={categoriaId}
                onChange={setCategoriaId}
                nomeInicial={receita.categorias_financeiras?.nome}
                className={inputClasses}
              />
            )}
          </div>

          <div>
            <label htmlFor="valor" className={labelClasses}>
              Valor
            </label>
            <CampoMoeda
              id="valor"
              required
              disabled={geradaPorHonorario}
              valor={valor}
              onChange={setValor}
              className={geradaPorHonorario ? inputDesabilitadoClasses : inputClasses}
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
            <label htmlFor="dataRecebimento" className={labelClasses}>
              Data de recebimento
            </label>
            <input
              id="dataRecebimento"
              type="date"
              value={dataRecebimento}
              onChange={(e) => setDataRecebimento(e.target.value)}
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
            placeholder="Ex: recebido via PIX, referente ao contrato Y"
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

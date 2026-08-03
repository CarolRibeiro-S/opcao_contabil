'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

export type Prazo = {
  id: string
  competencia: string | null
  data_vencimento: string | null
  status: string
  observacoes: string | null
  clientes: { nome_empresa: string } | null
  obrigacoes_acessorias: { nome: string } | null
}

export default function EditarPrazoForm({ prazo }: { prazo: Prazo }) {
  const router = useRouter()
  const supabase = createClient()

  const [competencia, setCompetencia] = useState(prazo.competencia?.slice(0, 7) ?? '')
  const [dataVencimento, setDataVencimento] = useState(prazo.data_vencimento ?? '')
  const [status, setStatus] = useState(prazo.status)
  const [observacoes, setObservacoes] = useState(prazo.observacoes ?? '')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const nomeObrigacao = prazo.obrigacoes_acessorias?.nome ?? 'Obrigação'
  const nomeCliente = prazo.clientes?.nome_empresa ?? 'Cliente'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error: updateError } = await supabase
      .from('prazos')
      .update({
        competencia: competencia ? `${competencia}-01` : null,
        data_vencimento: dataVencimento || null,
        status,
        observacoes: observacoes || null,
      })
      .eq('id', prazo.id)

    if (updateError) {
      setError('Não foi possível salvar as alterações. Tente novamente.')
      setLoading(false)
      return
    }

    registrarHistoricoAtividade({
      acao: 'editou',
      entidade: 'prazo',
      entidadeId: prazo.id,
      entidadeNome: `${nomeObrigacao} — ${nomeCliente}`,
    })

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

      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">Editar Prazo</h1>
      <p className="mb-8 text-sm text-navy-soft">
        {nomeObrigacao} — {nomeCliente}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
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
          <label htmlFor="status" className={labelClasses}>
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClasses}
          >
            <option value="pendente">Pendente</option>
            <option value="atencao">Atenção</option>
            <option value="em_dia">Em Dia</option>
            <option value="vencido">Vencido</option>
          </select>
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
          {loading ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  )
}

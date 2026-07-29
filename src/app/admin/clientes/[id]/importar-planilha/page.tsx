'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

type ResultadoMedico = {
  nome: string
  faturamento: number
  impostoDevido: number
}

type RespostaImportacao = {
  medicosProcessados: number
  faturamentoTotal: number
  medicosNaoEncontrados: string[]
  resultados: ResultadoMedico[]
}

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ImportarPlanilhaPage() {
  const params = useParams()
  const clienteId = params.id as string

  const [competencia, setCompetencia] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<RespostaImportacao | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!arquivo) return

    setError('')
    setLoading(true)
    setResultado(null)

    const formData = new FormData()
    formData.append('arquivo', arquivo)
    formData.append('clienteId', clienteId)
    formData.append('competencia', competencia)

    const resposta = await fetch('/api/importar-apuracao', {
      method: 'POST',
      body: formData,
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      setError(dados.error ?? 'Não foi possível processar a planilha.')
      setLoading(false)
      return
    }

    setResultado(dados)
    setLoading(false)
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={`/admin/clientes/${clienteId}/editar`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-navy"
      >
        ← Voltar para o cliente
      </Link>

      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">
        Importar planilha de apuração
      </h1>
      <p className="mb-8 text-sm text-navy-soft">
        Selecione a competência e a planilha (.xlsx) de apuração por médico gerada para esta clínica.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
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
          <label htmlFor="arquivo" className={labelClasses}>
            Planilha (.xlsx)
          </label>
          <input
            id="arquivo"
            type="file"
            accept=".xlsx"
            required
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-charcoal file:mr-3 file:rounded-[3px] file:border-[1.3px] file:border-navy file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy file:transition-colors file:duration-200 hover:file:bg-navy hover:file:text-paper"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !arquivo}
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:opacity-60"
        >
          {loading ? 'Processando...' : 'Processar planilha'}
        </button>
      </form>

      {resultado && (
        <div className="mt-10 border-t border-rule pt-8">
          <h2 className="mb-1 font-display text-lg font-semibold text-navy">Resultado da importação</h2>
          <p className="mb-4 text-sm text-navy-soft">
            {resultado.medicosProcessados} médico(s) processado(s) — faturamento total{' '}
            {formatarValor(resultado.faturamentoTotal)}
          </p>

          {resultado.medicosNaoEncontrados.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Atenção: profissional(is) novo(s) cadastrado(s) automaticamente</p>
              <p className="mt-1">
                Não encontramos cadastro prévio para: {resultado.medicosNaoEncontrados.join(', ')}. Um novo
                registro foi criado — confira se não é um nome já existente escrito de forma diferente.
              </p>
            </div>
          )}

          {resultado.resultados.length === 0 ? (
            <p className="text-sm text-navy-soft">
              Nenhum médico com faturamento maior que zero foi encontrado nessa planilha.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-rule bg-white">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-paper-dim">
                  <tr>
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                      Médico
                    </th>
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                      Faturamento
                    </th>
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                      Imposto devido
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.resultados.map((medico) => (
                    <tr key={medico.nome} className="border-t border-rule">
                      <td className="px-4 py-3 font-medium text-navy">{medico.nome}</td>
                      <td className="px-4 py-3 text-charcoal">{formatarValor(medico.faturamento)}</td>
                      <td className="px-4 py-3 text-charcoal">{formatarValor(medico.impostoDevido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

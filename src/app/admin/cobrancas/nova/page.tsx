'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SelectCliente from '@/components/admin/SelectCliente'
import CampoMoeda from '@/components/shared/CampoMoeda'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'
import { sanitizarNomeArquivo } from '@/lib/storage/sanitizarNomeArquivo'

function formatarCompetenciaCurta(competencia: string) {
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano}`
}

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

type FormaPagamento = 'pix' | 'boleto'

// Pré-preenche a mensagem ao escolher a forma de pagamento — o admin pode
// editar livremente depois, isso só poupa digitar o texto mais comum.
const MENSAGENS_PADRAO: Record<FormaPagamento, string> = {
  pix: 'Segue seu honorário mensal para pagamento via PIX.',
  boleto: 'Segue seu honorário mensal para pagamento via boleto.',
}

export default function NovaCobrancaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [clienteId, setClienteId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [competencia, setCompetencia] = useState('')
  const [valor, setValor] = useState<number | null>(null)
  const [dataVencimento, setDataVencimento] = useState('')

  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(null)
  const [mensagemPagamento, setMensagemPagamento] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [arquivoBoleto, setArquivoBoleto] = useState<File | null>(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function selecionarFormaPagamento(forma: FormaPagamento) {
    setFormaPagamento(forma)
    setMensagemPagamento(MENSAGENS_PADRAO[forma])
  }

  function limparFormaPagamento() {
    setFormaPagamento(null)
    setMensagemPagamento('')
    setChavePix('')
    setArquivoBoleto(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    let boletoCaminho: string | null = null
    let boletoNome: string | null = null

    if (formaPagamento === 'boleto' && arquivoBoleto) {
      // Mesmo padrão de caminho já usado nos outros uploads pro bucket
      // 'documentos-clientes': {cliente_id}/{timestamp}-{nome}, evita
      // colisão se o mesmo nome de arquivo for enviado de novo depois.
      const caminho = `${clienteId}/${Date.now()}-${sanitizarNomeArquivo(arquivoBoleto.name)}`

      const { error: uploadError } = await supabase.storage
        .from('documentos-clientes')
        .upload(caminho, arquivoBoleto)

      if (uploadError) {
        console.error('[NovaCobranca] Erro ao enviar boleto:', uploadError)
        setError(`Não foi possível enviar o boleto: ${uploadError.message}`)
        setLoading(false)
        return
      }

      boletoCaminho = caminho
      boletoNome = arquivoBoleto.name
    }

    const { data: cobranca, error: insertError } = await supabase
      .from('cobrancas')
      .insert({
        cliente_id: clienteId || null,
        descricao,
        competencia: competencia ? `${competencia}-01` : null,
        valor,
        data_vencimento: dataVencimento || null,
        status: 'em_aberto',
        forma_pagamento: formaPagamento,
        mensagem_pagamento: mensagemPagamento.trim() || null,
        chave_pix: formaPagamento === 'pix' ? chavePix.trim() || null : null,
        boleto_caminho_arquivo: boletoCaminho,
        boleto_nome_arquivo: boletoNome,
      })
      .select('id, clientes(nome_empresa)')
      .single<{ id: string; clientes: { nome_empresa: string } | null }>()

    if (insertError || !cobranca) {
      setError('Não foi possível salvar o honorário. Tente novamente.')
      setLoading(false)
      return
    }

    registrarHistoricoAtividade({
      acao: 'criou',
      entidade: 'honorario',
      entidadeId: cobranca.id,
      entidadeNome: `${cobranca.clientes?.nome_empresa ?? 'Cliente'} — ${formatarCompetenciaCurta(competencia)}`,
    })

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

        <div className="rounded-lg border border-rule bg-paper-dim p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className={labelClasses}>Forma de pagamento (opcional)</span>
            {formaPagamento && (
              <button
                type="button"
                onClick={limparFormaPagamento}
                className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => selecionarFormaPagamento('pix')}
              className={`flex-1 rounded-[3px] border-[1.3px] px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                formaPagamento === 'pix'
                  ? 'border-lime bg-lime/15 text-navy'
                  : 'border-rule bg-white text-navy-soft hover:border-navy'
              }`}
            >
              Pix
            </button>
            <button
              type="button"
              onClick={() => selecionarFormaPagamento('boleto')}
              className={`flex-1 rounded-[3px] border-[1.3px] px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                formaPagamento === 'boleto'
                  ? 'border-lime bg-lime/15 text-navy'
                  : 'border-rule bg-white text-navy-soft hover:border-navy'
              }`}
            >
              Boleto
            </button>
          </div>

          {formaPagamento && (
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="mensagemPagamento" className={labelClasses}>
                  Mensagem para o cliente
                </label>
                <textarea
                  id="mensagemPagamento"
                  rows={2}
                  value={mensagemPagamento}
                  onChange={(e) => setMensagemPagamento(e.target.value)}
                  className={`${inputClasses} resize-y`}
                />
              </div>

              {formaPagamento === 'pix' && (
                <div>
                  <label htmlFor="chavePix" className={labelClasses}>
                    Chave PIX
                  </label>
                  <input
                    id="chavePix"
                    type="text"
                    value={chavePix}
                    onChange={(e) => setChavePix(e.target.value)}
                    className={inputClasses}
                  />
                </div>
              )}

              {formaPagamento === 'boleto' && (
                <div>
                  <label htmlFor="boleto" className={labelClasses}>
                    Arquivo do boleto
                  </label>
                  <input
                    id="boleto"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setArquivoBoleto(e.target.files?.[0] ?? null)}
                    className="block text-sm text-charcoal file:mr-3 file:rounded-[3px] file:border-[1.3px] file:border-navy file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy file:transition-colors file:duration-200 hover:file:bg-navy hover:file:text-paper"
                  />
                  {arquivoBoleto && <p className="mt-1.5 text-xs text-navy-soft">📎 {arquivoBoleto.name}</p>}
                </div>
              )}
            </div>
          )}
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

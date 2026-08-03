import { Fragment } from 'react'
import { getClienteAtual } from '@/lib/portal/getClienteAtual'
import PagamentoCobranca from '@/components/portal/PagamentoCobranca'

type Cobranca = {
  id: string
  descricao: string | null
  competencia: string | null
  valor: number | null
  status: string
  data_vencimento: string | null
  data_pagamento: string | null
  forma_pagamento: string | null
  chave_pix: string | null
  boleto_nome_arquivo: string | null
  boleto_caminho_arquivo: string | null
  mensagem_pagamento: string | null
  visualizado_pelo_cliente_em: string | null
}

const statusBadge: Record<string, string> = {
  em_aberto: 'bg-amber-50 text-amber-700 border border-amber-200',
  pago: 'bg-[#eef7e0] text-[#4f8f2a] border border-[#c8e2a1]',
  atrasado: 'bg-red-50 text-red-700 border border-red-200',
}

const statusLabel: Record<string, string> = {
  em_aberto: 'Em Aberto',
  pago: 'Pago',
  atrasado: 'Atrasado',
}

function formatarData(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarCompetencia(data: string | null) {
  if (!data) return '—'
  const [ano, mes] = data.split('-')
  return `${mes}/${ano}`
}

function formatarValor(valor: number | null) {
  if (valor === null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function PortalCobrancasPage() {
  const { supabase, cliente } = await getClienteAtual()

  if (!cliente) {
    return (
      <p className="text-sm text-navy-soft">
        Não encontramos um cadastro de cliente vinculado à sua conta.
      </p>
    )
  }

  const { data: cobrancas } = await supabase
    .from('cobrancas')
    .select(
      'id, descricao, competencia, valor, status, data_vencimento, data_pagamento, forma_pagamento, chave_pix, boleto_nome_arquivo, boleto_caminho_arquivo, mensagem_pagamento, visualizado_pelo_cliente_em'
    )
    .eq('cliente_id', cliente.id)
    .order('data_vencimento', { ascending: true })
    .returns<Cobranca[]>()

  return (
    <div>
      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Honorários Contábeis</h1>

      {/* mt-[83px]: mesmo valor (e mesmo cálculo) já usado na grade de cards
          da Home do Portal — alinha o início do conteúdo com a linha azul
          de navegação da sidebar. Estrutura idêntica à da Home (h1 sozinho,
          1 linha, mb-8), então o mesmo valor se aplica sem recálculo. */}
      <div className="mt-[83px]">
        {!cobrancas || cobrancas.length === 0 ? (
          <p className="text-sm text-navy-soft">Nenhum honorário registrado ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule bg-white">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-paper-dim">
                <tr>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Competência
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Valor
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Vencimento
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Pagamento
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((cobranca) => (
                  <Fragment key={cobranca.id}>
                    <tr className="border-t border-rule">
                      <td className="px-4 py-3">
                        <p className="font-medium text-navy">{formatarCompetencia(cobranca.competencia)}</p>
                        {cobranca.descricao && (
                          <p className="mt-0.5 text-xs text-navy-soft/70">{cobranca.descricao}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-charcoal">{formatarValor(cobranca.valor)}</td>
                      <td className="px-4 py-3 text-charcoal">{formatarData(cobranca.data_vencimento)}</td>
                      <td className="px-4 py-3 text-charcoal">{formatarData(cobranca.data_pagamento)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                            statusBadge[cobranca.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                          }`}
                        >
                          {statusLabel[cobranca.status] ?? cobranca.status}
                        </span>
                      </td>
                    </tr>

                    {/* Só existe quando o admin preencheu uma mensagem de
                        pagamento (Pix ou Boleto) — visualização/download
                        apenas, sem nenhuma opção de edição pro cliente. */}
                    {cobranca.mensagem_pagamento && (
                      <tr className="border-t border-rule bg-paper-dim">
                        <td colSpan={5} className="px-4 py-4">
                          <PagamentoCobranca
                            cobrancaId={cobranca.id}
                            formaPagamento={cobranca.forma_pagamento}
                            chavePix={cobranca.chave_pix}
                            boletoNomeArquivo={cobranca.boleto_nome_arquivo}
                            boletoCaminhoArquivo={cobranca.boleto_caminho_arquivo}
                            mensagemPagamento={cobranca.mensagem_pagamento}
                            visualizadoEm={cobranca.visualizado_pelo_cliente_em}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

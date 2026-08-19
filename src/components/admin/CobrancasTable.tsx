'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import MarcarComoPago from './MarcarComoPago'
import ReenviarEmailCobranca from './ReenviarEmailCobranca'

export type FalhaEntrega = { tipo: string; detalhe: string | null; criadoEm: string }

type Cobranca = {
  id: string
  competencia: string | null
  valor: number | null
  status: string
  data_vencimento: string | null
  descricao: string | null
  boleto_caminho_arquivo: string | null
  enviado_email_em: string | null
  falhaEntrega: FalhaEntrega | null
  clientes: { nome_empresa: string } | null
}

const TIPO_FALHA_LABEL: Record<string, string> = {
  bounced: 'Bounce',
  failed: 'Falha no despacho',
  delivery_delayed: 'Entrega atrasada',
  complained: 'Marcado como spam',
}

const statusBadge: Record<string, string> = {
  em_aberto: 'bg-amber-50 text-amber-700 border border-amber-200',
  pago: 'bg-success-bg text-success border border-success-border',
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

function formatarDataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
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

// 3 estados possíveis, não só os 2 pedidos ("Enviado"/"Aguardando boleto")
// — precisou de um terceiro ("e-mail pendente") pro caso em que o boleto já
// foi anexado mas o envio automático falhou (ou nunca foi disparado, ex:
// forma de pagamento não era 'boleto' no momento do anexo). Sem esse
// terceiro estado, esse caso ficaria indistinguível de "Enviado" pro
// Hederson, escondendo justamente os casos que precisam de reenvio manual.
function BadgeEmail({ boletoCaminho, enviadoEmailEm }: { boletoCaminho: string | null; enviadoEmailEm: string | null }) {
  if (!boletoCaminho) {
    return (
      <span className="rounded-full border border-rule bg-paper-dim px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-navy-soft">
        Aguardando boleto
      </span>
    )
  }

  if (!enviadoEmailEm) {
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-amber-700">
        E-mail pendente
      </span>
    )
  }

  return (
    <span className="rounded-full border border-success-border bg-success-bg px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-success">
      Enviado em {formatarDataCurta(enviadoEmailEm)}
    </span>
  )
}

// "Enviado" só significa "sem falha conhecida até agora" (ver texto de
// ajuda perto do filtro) — não é confirmação positiva de entrega, a
// Resend não avisa "chegou na caixa de entrada", só falhas. Esse badge é
// quem carrega a informação forte: se a Resend confirmou uma falha real
// (webhook, ver api/webhooks/resend), aparece aqui, com o motivo.
function BadgeFalhaEntrega({ falha }: { falha: FalhaEntrega | null }) {
  if (!falha) return null

  const rotulo = TIPO_FALHA_LABEL[falha.tipo] ?? falha.tipo

  return (
    <div className="mt-1.5">
      <span
        title={falha.detalhe ?? rotulo}
        className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-red-700"
      >
        Não entregue — {rotulo}
      </span>
      {falha.detalhe && <p className="mt-1 max-w-[240px] text-[11px] text-red-600/80">{falha.detalhe}</p>}
    </div>
  )
}

export default function CobrancasTable({ cobrancas }: { cobrancas: Cobranca[] }) {
  const [somenteAguardandoBoleto, setSomenteAguardandoBoleto] = useState(false)
  const [somenteNaoEntregues, setSomenteNaoEntregues] = useState(false)

  const visiveis = useMemo(
    () =>
      cobrancas
        .filter((cobranca) => !somenteAguardandoBoleto || !cobranca.boleto_caminho_arquivo)
        .filter((cobranca) => !somenteNaoEntregues || !!cobranca.falhaEntrega),
    [cobrancas, somenteAguardandoBoleto, somenteNaoEntregues]
  )

  const totalAguardando = useMemo(() => cobrancas.filter((cobranca) => !cobranca.boleto_caminho_arquivo).length, [cobrancas])
  const totalNaoEntregues = useMemo(() => cobrancas.filter((cobranca) => !!cobranca.falhaEntrega).length, [cobrancas])

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setSomenteAguardandoBoleto((atual) => !atual)}
          className={`rounded-[3px] border-[1.3px] px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
            somenteAguardandoBoleto
              ? 'border-lime bg-lime/15 text-navy'
              : 'border-rule bg-white text-navy-soft hover:border-navy'
          }`}
        >
          Só aguardando boleto {totalAguardando > 0 && `(${totalAguardando})`}
        </button>

        <button
          type="button"
          onClick={() => setSomenteNaoEntregues((atual) => !atual)}
          className={`rounded-[3px] border-[1.3px] px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
            somenteNaoEntregues
              ? 'border-red-400 bg-red-50 text-red-700'
              : 'border-rule bg-white text-navy-soft hover:border-navy'
          }`}
        >
          Só não entregues {totalNaoEntregues > 0 && `(${totalNaoEntregues})`}
        </button>
      </div>

      <p className="mb-5 text-xs text-navy-soft/80">
        &quot;Enviado&quot; significa apenas que não há falha de entrega conhecida até agora — a Resend só avisa
        sobre falhas (bounce, spam, atraso), não confirma que a mensagem chegou de verdade na caixa de entrada.
      </p>

      {visiveis.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum honorário encontrado com esse filtro.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-paper-dim">
                <tr>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Cliente
                  </th>
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
                    Status
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Boleto/E-mail
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((cobranca) => (
                  <tr key={cobranca.id} className="border-t border-rule">
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{cobranca.clientes?.nome_empresa ?? '—'}</p>
                      {cobranca.descricao && (
                        <p className="mt-0.5 text-xs text-navy-soft/70">{cobranca.descricao}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-charcoal">{formatarCompetencia(cobranca.competencia)}</td>
                    <td className="px-4 py-3 text-charcoal">{formatarValor(cobranca.valor)}</td>
                    <td className="px-4 py-3 text-charcoal">{formatarData(cobranca.data_vencimento)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                          statusBadge[cobranca.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                        }`}
                      >
                        {statusLabel[cobranca.status] ?? cobranca.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <BadgeEmail
                        boletoCaminho={cobranca.boleto_caminho_arquivo}
                        enviadoEmailEm={cobranca.enviado_email_em}
                      />
                      <BadgeFalhaEntrega falha={cobranca.falhaEntrega} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/cobrancas/${cobranca.id}/editar`}
                          className="text-xs font-semibold text-navy-soft transition-colors duration-200 hover:text-navy"
                        >
                          Editar
                        </Link>
                        {cobranca.boleto_caminho_arquivo && <ReenviarEmailCobranca id={cobranca.id} />}
                        <MarcarComoPago
                          id={cobranca.id}
                          status={cobranca.status}
                          entidadeNome={`${cobranca.clientes?.nome_empresa ?? 'Cliente'} — ${formatarCompetencia(cobranca.competencia)}`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

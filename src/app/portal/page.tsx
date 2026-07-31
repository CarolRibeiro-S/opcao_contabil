import Link from 'next/link'
import { getClienteAtual } from '@/lib/portal/getClienteAtual'
import { ICONES } from '@/components/shared/icons'

type Prazo = {
  id: string
  data_vencimento: string | null
  status: string
  obrigacoes_acessorias: { nome: string } | null
}

type Cobranca = {
  id: string
  descricao: string | null
  competencia: string | null
  valor: number | null
  data_vencimento: string | null
}

const cardClasses =
  'rounded-lg border border-rule bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md'

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

function somarDias(dataIso: string, dias: number) {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

function diasEntre(dataInicio: string, dataFim: string) {
  const [a1, m1, d1] = dataInicio.split('-').map(Number)
  const [a2, m2, d2] = dataFim.split('-').map(Number)
  const inicio = Date.UTC(a1, m1 - 1, d1)
  const fim = Date.UTC(a2, m2 - 1, d2)
  return Math.round((fim - inicio) / (1000 * 60 * 60 * 24))
}

function IconeCard({ chave, className }: { chave: keyof typeof ICONES; className?: string }) {
  const Icon = ICONES[chave]
  return <Icon className={className ?? 'h-5 w-5'} />
}

function CardIconBadge({ chave, className }: { chave: keyof typeof ICONES; className: string }) {
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${className}`}>
      <IconeCard chave={chave} className="h-5 w-5" />
    </div>
  )
}

export default async function PortalDashboard() {
  const { supabase, cliente } = await getClienteAtual()

  if (!cliente) {
    return (
      <p className="text-sm text-navy-soft">
        Não encontramos um cadastro de cliente vinculado à sua conta.
      </p>
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const daqui15Dias = somarDias(hoje, 15)

  const [{ data: prazosProximos }, { data: cobrancasEmAberto }, { data: comunicadosPendentes }] =
    await Promise.all([
      supabase
        .from('prazos')
        .select('id, data_vencimento, status, obrigacoes_acessorias(nome)')
        .eq('cliente_id', cliente.id)
        .gte('data_vencimento', hoje)
        .lte('data_vencimento', daqui15Dias)
        .order('data_vencimento', { ascending: true })
        .returns<Prazo[]>(),
      supabase
        .from('cobrancas')
        .select('id, descricao, competencia, valor, data_vencimento')
        .eq('cliente_id', cliente.id)
        .eq('status', 'em_aberto')
        .order('data_vencimento', { ascending: true })
        .returns<Cobranca[]>(),
      supabase.from('comunicados').select('id').eq('cliente_id', cliente.id).eq('status', 'pendente'),
    ])

  const listaPrazos = prazosProximos ?? []
  const listaCobrancas = cobrancasEmAberto ?? []
  const totalComunicadosPendentes = comunicadosPendentes?.length ?? 0

  const proximaCobranca = listaCobrancas[0] ?? null
  const cobrancaAtrasada = proximaCobranca?.data_vencimento ? proximaCobranca.data_vencimento < hoje : false

  return (
    <div>
      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">
        Olá, {cliente.nome_empresa}
      </h1>

      {totalComunicadosPendentes > 0 && (
        <Link
          href="/portal/comunicados"
          className="mb-8 flex items-center justify-between rounded-lg border border-lime/40 bg-lime/10 px-5 py-4 text-sm font-medium text-navy transition-colors duration-200 hover:bg-lime/15"
        >
          <span>
            Você tem {totalComunicadosPendentes} solicitação
            {totalComunicadosPendentes > 1 ? 'ões' : ''} do seu contador
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={cardClasses}>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                Próximos Impostos
              </p>
              <p className="mt-0.5 text-xs text-navy-soft">Vencendo nos próximos 15 dias</p>
            </div>
            <CardIconBadge
              chave="prazos"
              className={
                listaPrazos.some((prazo) => prazo.data_vencimento && diasEntre(hoje, prazo.data_vencimento) <= 3)
                  ? 'bg-red-50 text-red-600'
                  : 'bg-navy/5 text-navy'
              }
            />
          </div>

          {listaPrazos.length === 0 ? (
            <p className="py-6 text-center text-sm text-navy-soft">
              Nenhum imposto vencendo nos próximos 15 dias. 🎉
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {listaPrazos.map((prazo) => {
                const diasRestantes = prazo.data_vencimento ? diasEntre(hoje, prazo.data_vencimento) : 0
                const urgente = diasRestantes <= 3

                return (
                  <li key={prazo.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-charcoal">
                      {prazo.obrigacoes_acessorias?.nome ?? '—'}
                    </span>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-[12px] text-navy-soft">
                        {formatarData(prazo.data_vencimento)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${
                          urgente
                            ? 'border border-red-200 bg-red-50 text-red-700'
                            : 'border border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {diasRestantes <= 0 ? 'Vence hoje' : diasRestantes === 1 ? '1 dia' : `${diasRestantes} dias`}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className={cardClasses}>
          <div className="mb-4 flex items-start justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">Honorários</p>
            <CardIconBadge
              chave="honorarios"
              className={
                !proximaCobranca
                  ? 'bg-lime/10 text-[#4f8f2a]'
                  : cobrancaAtrasada
                    ? 'bg-red-50 text-red-600'
                    : 'bg-amber-50 text-amber-600'
              }
            />
          </div>

          {!proximaCobranca ? (
            <p className="py-6 text-center text-sm text-navy-soft">
              Nenhum honorário pendente. Você está em dia. 🎉
            </p>
          ) : (
            <>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                  cobrancaAtrasada
                    ? 'border border-red-200 bg-red-50 text-red-700'
                    : 'border border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {cobrancaAtrasada ? 'Atrasado' : 'Pendente'}
              </span>

              <p className="mt-3 font-display text-3xl font-semibold text-navy">
                {formatarValor(proximaCobranca.valor)}
              </p>
              <p className="mt-1 text-sm text-navy-soft">
                {proximaCobranca.descricao ?? 'Honorário'} — competência{' '}
                {formatarCompetencia(proximaCobranca.competencia)}
              </p>
              <p className="mt-1 font-mono text-[12px] text-navy-soft">
                Vencimento: {formatarData(proximaCobranca.data_vencimento)}
              </p>

              {listaCobrancas.length > 1 && (
                <p className="mt-2 text-xs text-navy-soft">
                  + {listaCobrancas.length - 1} outro(s) honorário(s) em aberto
                </p>
              )}
            </>
          )}

          <div className="mt-5 border-t border-rule pt-4">
            <Link
              href="/portal/cobrancas"
              className="text-xs font-semibold text-navy-soft underline decoration-rule underline-offset-2 transition-colors duration-200 hover:text-navy hover:decoration-navy"
            >
              Ver honorários
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

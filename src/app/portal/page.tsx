import Link from 'next/link'
import { getClienteAtual } from '@/lib/portal/getClienteAtual'

type Prazo = {
  id: string
  data_vencimento: string | null
  status: string
  obrigacoes_acessorias: { nome: string } | null
}

type Cobranca = {
  id: string
  valor: number | null
  data_vencimento: string | null
}

function formatarData(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarValor(valor: number | null) {
  if (valor === null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

  const { data: prazos } = await supabase
    .from('prazos')
    .select('id, data_vencimento, status, obrigacoes_acessorias(nome)')
    .eq('cliente_id', cliente.id)
    .order('data_vencimento', { ascending: true })
    .returns<Prazo[]>()

  const { data: cobrancas } = await supabase
    .from('cobrancas')
    .select('id, valor, data_vencimento')
    .eq('cliente_id', cliente.id)
    .eq('status', 'em_aberto')
    .order('data_vencimento', { ascending: true })
    .returns<Cobranca[]>()

  const { data: comunicadosPendentes } = await supabase
    .from('comunicados')
    .select('id')
    .eq('cliente_id', cliente.id)
    .eq('status', 'pendente')

  const listaPrazos = prazos ?? []
  const emDia = listaPrazos.filter((prazo) => prazo.status === 'em_dia').length
  const pendentesOuAtencao = listaPrazos.filter(
    (prazo) => prazo.status === 'pendente' || prazo.status === 'atencao'
  ).length
  const vencidos = listaPrazos.filter((prazo) => prazo.status === 'vencido').length

  const proximosVencimentos = listaPrazos.filter((prazo) => prazo.status !== 'em_dia').slice(0, 5)

  const listaCobrancas = cobrancas ?? []
  const totalComunicadosPendentes = comunicadosPendentes?.length ?? 0

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

      <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-lg border border-rule bg-white p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">Em dia</p>
          <p className="mt-2 font-display text-3xl font-semibold text-[#4f8f2a]">{emDia}</p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
            Pendente / Atenção
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-amber-600">
            {pendentesOuAtencao}
          </p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">Vencido</p>
          <p className="mt-2 font-display text-3xl font-semibold text-red-600">{vencidos}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold text-navy">Próximos vencimentos</h2>
          {proximosVencimentos.length === 0 ? (
            <p className="text-sm text-navy-soft">Nenhum prazo pendente no momento.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {proximosVencimentos.map((prazo) => (
                <li
                  key={prazo.id}
                  className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 text-sm"
                >
                  <span className="text-charcoal">{prazo.obrigacoes_acessorias?.nome ?? '—'}</span>
                  <span className="font-mono text-[12px] text-navy-soft">
                    {formatarData(prazo.data_vencimento)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-display text-lg font-semibold text-navy">Honorários em aberto</h2>
          {listaCobrancas.length === 0 ? (
            <p className="text-sm text-navy-soft">Nenhum honorário em aberto.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {listaCobrancas.map((cobranca) => (
                <li
                  key={cobranca.id}
                  className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 text-sm"
                >
                  <span className="text-charcoal">{formatarValor(cobranca.valor)}</span>
                  <span className="font-mono text-[12px] text-navy-soft">
                    {formatarData(cobranca.data_vencimento)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ICONES } from '@/components/shared/icons'
import CardComunicados from '@/components/admin/CardComunicados'

type PrazoResumo = {
  id: string
  data_vencimento: string | null
  status: string
  clientes: { nome_empresa: string } | null
  obrigacoes_acessorias: { nome: string } | null
}

type TarefaResumo = {
  id: string
  titulo: string
  data_limite: string | null
  clientes: { nome_empresa: string } | null
}

type CobrancaResumo = {
  id: string
  valor: number | null
  status: string
}

type LancamentoResumo = { valor: number | null }

type ComunicadoResumo = {
  id: string
  cliente_id: string
  titulo: string
  tipo: string
  status: string
  created_at: string
  clientes: { nome_empresa: string } | null
}

const statusBadgePrazo: Record<string, string> = {
  pendente: 'bg-paper-dim text-navy-soft border border-rule',
  atencao: 'bg-amber-50 text-amber-700 border border-amber-200',
  vencido: 'bg-red-50 text-red-700 border border-red-200',
}

const statusLabelPrazo: Record<string, string> = {
  pendente: 'Pendente',
  atencao: 'Atenção',
  vencido: 'Vencido',
}

const atalhoClasses =
  'text-xs font-semibold text-navy-soft underline decoration-rule underline-offset-2 transition-colors duration-200 hover:text-navy hover:decoration-navy'

const cardClasses =
  'rounded-lg border border-rule bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md'

function formatarData(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function somarDias(dataIso: string, dias: number) {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function IconeCard({ chave, className }: { chave: keyof typeof ICONES; className?: string }) {
  const Icon = ICONES[chave]
  return <Icon className={className ?? 'h-5 w-5'} />
}

function IconAlerta({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 3.3L17.5 16.2h-15z" />
      <path d="M10 8.2v3.3M10 14.2h.01" />
    </svg>
  )
}

function CardIconBadge({
  chave,
  className,
}: {
  chave: keyof typeof ICONES
  className: string
}) {
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${className}`}>
      <IconeCard chave={chave} className="h-5 w-5" />
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const hoje = new Date().toISOString().slice(0, 10)
  const daquiA2Dias = somarDias(hoje, 2)
  const daquiA7Dias = somarDias(hoje, 7)
  // Janela fixa de 30 dias pros cards de Comunicados — mantém o Dashboard
  // leve (não carrega o histórico inteiro). Dentro dessa janela, os campos
  // de busca/data de cada card (CardComunicados) filtram no client-side.
  const trintaDiasAtras = `${somarDias(hoje, -30)}T00:00:00`
  const [anoAtual, mesAtual, diaAtual] = hoje.split('-').map(Number)
  const competenciaAtual = `${hoje.slice(0, 7)}-01`

  const dataExtenso = capitalizar(
    new Date(Date.UTC(anoAtual, mesAtual - 1, diaAtual)).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  )

  const [
    { count: clientesAtivos },
    { count: clientesInativos },
    { data: cobrancasMes },
    { data: receitasMes },
    { data: despesasMes },
    { data: prazosSemana },
    { count: tarefasPendentesTotal },
    { data: tarefasProximas },
    { data: comunicadosRecentes },
  ] = await Promise.all([
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('status', 'inativo'),
    supabase
      .from('cobrancas')
      .select('id, valor, status')
      .eq('competencia', competenciaAtual)
      .returns<CobrancaResumo[]>(),
    // Mesmo cálculo já usado na DRE e no Dashboard Financeiro: receita
    // realizada (recebida) menos despesa total incorrida na competência.
    supabase
      .from('receitas')
      .select('valor')
      .eq('status', 'recebido')
      .eq('competencia', competenciaAtual)
      .returns<LancamentoResumo[]>(),
    supabase
      .from('despesas')
      .select('valor')
      .eq('competencia', competenciaAtual)
      .returns<LancamentoResumo[]>(),
    supabase
      .from('prazos')
      .select('id, data_vencimento, status, clientes(nome_empresa), obrigacoes_acessorias(nome)')
      .gte('data_vencimento', hoje)
      .lte('data_vencimento', daquiA7Dias)
      .neq('status', 'em_dia')
      .order('data_vencimento', { ascending: true })
      .returns<PrazoResumo[]>(),
    supabase
      .from('tarefas')
      .select('id', { count: 'exact', head: true })
      .in('status', ['a_fazer', 'em_andamento']),
    supabase
      .from('tarefas')
      .select('id, titulo, data_limite, clientes(nome_empresa)')
      .in('status', ['a_fazer', 'em_andamento'])
      .order('data_limite', { ascending: true })
      .limit(5)
      .returns<TarefaResumo[]>(),
    supabase
      .from('comunicados')
      .select('id, cliente_id, titulo, tipo, status, created_at, clientes(nome_empresa)')
      .gte('created_at', trintaDiasAtras)
      .order('created_at', { ascending: false })
      .returns<ComunicadoResumo[]>(),
  ])

  const listaCobrancas = cobrancasMes ?? []
  const adimplentes = listaCobrancas.filter((cobranca) => cobranca.status === 'pago')
  const inadimplentes = listaCobrancas.filter(
    (cobranca) => cobranca.status === 'em_aberto' || cobranca.status === 'atrasado'
  )
  const totalAdimplente = adimplentes.reduce((soma, cobranca) => soma + (cobranca.valor ?? 0), 0)
  const totalInadimplente = inadimplentes.reduce((soma, cobranca) => soma + (cobranca.valor ?? 0), 0)
  const totalGeralCobrancas = totalAdimplente + totalInadimplente
  const percentualAdimplente = totalGeralCobrancas > 0 ? (totalAdimplente / totalGeralCobrancas) * 100 : 0

  const receitaDoMes = (receitasMes ?? []).reduce((soma, receita) => soma + (receita.valor ?? 0), 0)
  const despesaDoMes = (despesasMes ?? []).reduce((soma, despesa) => soma + (despesa.valor ?? 0), 0)
  const resultadoDoMes = receitaDoMes - despesaDoMes
  const resultadoDoMesPositivo = resultadoDoMes >= 0

  const raioDonut = 26
  const circunferenciaDonut = 2 * Math.PI * raioDonut
  const arcoAdimplente = (percentualAdimplente / 100) * circunferenciaDonut

  const listaPrazos = prazosSemana ?? []
  const listaTarefas = tarefasProximas ?? []

  const totalClientes = (clientesAtivos ?? 0) + (clientesInativos ?? 0)
  const percentualClientesAtivos =
    totalClientes > 0 ? Math.round(((clientesAtivos ?? 0) / totalClientes) * 100) : 0

  const temObrigacaoUrgente = listaPrazos.some(
    (prazo) => prazo.data_vencimento && prazo.data_vencimento <= daquiA2Dias
  )

  const listaComunicados = comunicadosRecentes ?? []
  const comunicadosAviso = listaComunicados.filter((comunicado) => comunicado.tipo === 'aviso')
  const comunicadosSolicitacao = listaComunicados.filter(
    (comunicado) => comunicado.tipo === 'solicitacao_documento'
  )

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-navy">Dashboard</h1>
      <p className="mb-8 mt-1 text-sm text-navy-soft">{dataExtenso}</p>

      {/* Comunicados (Avisos e Solicitação de Documento) no topo, antes de
          qualquer outro card — pedido explícito, sem mt-[41px] aqui (esse
          ajuste de alinhamento com a sidebar pertence à primeira grade
          visual da página, que agora é esta). */}
      <div className="mt-[41px] mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CardComunicados titulo="Avisos - Enviado a Clientes" icone="comunicados" comunicados={comunicadosAviso} />
        <CardComunicados
          titulo="Solicitação de Documento - Solicitado para Clientes"
          icone="documentos"
          comunicados={comunicadosSolicitacao}
        />
      </div>

      {/* Linha 1 — saúde geral do negócio: clientes, financeiro e adimplência lado a lado. */}
      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className={cardClasses}>
          <div className="flex items-start justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
              Clientes Ativos
            </p>
            <CardIconBadge chave="clientes" className="bg-navy/5 text-navy" />
          </div>
          <p className="mt-4 font-display text-3xl font-semibold text-navy">{clientesAtivos ?? 0}</p>
          <p className="mt-1.5 text-xs text-navy-soft">
            {clientesAtivos ?? 0} de {totalClientes} clientes ativos
          </p>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-paper-dim">
            <div
              className="h-full rounded-full bg-lime transition-[width] duration-300"
              style={{ width: `${percentualClientesAtivos}%` }}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-rule pt-4">
            <Link href="/admin/clientes/novo" className={atalhoClasses}>
              Cadastrar novo
            </Link>
            <Link href="/admin/clientes" className={atalhoClasses}>
              Ver todos
            </Link>
          </div>
        </div>

        <div className={cardClasses}>
          <div className="flex items-start justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
              Financeiro do Mês
            </p>
            <CardIconBadge
              chave="financeiro"
              className={resultadoDoMesPositivo ? 'bg-lime/10 text-success' : 'bg-red-50 text-red-600'}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-navy-soft">Receita</p>
              <p className="text-sm font-semibold text-navy">{formatarValor(receitaDoMes)}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-navy-soft">Despesa</p>
              <p className="text-sm font-semibold text-navy">{formatarValor(despesaDoMes)}</p>
            </div>
          </div>

          <p
            className={`mt-4 font-display text-2xl font-semibold ${
              resultadoDoMesPositivo ? 'text-success' : 'text-red-600'
            }`}
          >
            {formatarValor(resultadoDoMes)}
          </p>
          <p className="mt-1 text-xs text-navy-soft">Resultado do mês</p>

          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-rule pt-4">
            <Link href="/admin/financeiro/dashboard" className={atalhoClasses}>
              Ver Financeiro
            </Link>
          </div>
        </div>

        <div className={cardClasses}>
          <div className="flex items-start justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
              Adimplência do Mês
            </p>
            <CardIconBadge chave="honorarios" className="bg-lime/10 text-success" />
          </div>

          <div className="mt-4 flex items-center gap-4">
            <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={raioDonut}
                fill="none"
                stroke={totalGeralCobrancas > 0 ? 'var(--warning)' : 'var(--rule)'}
                strokeWidth="8"
              />
              {totalGeralCobrancas > 0 && (
                <circle
                  cx="32"
                  cy="32"
                  r={raioDonut}
                  fill="none"
                  stroke="var(--lime)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${arcoAdimplente} ${circunferenciaDonut - arcoAdimplente}`}
                />
              )}
            </svg>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full bg-lime" />
                <span className="text-navy-soft">Adimplentes ({adimplentes.length})</span>
              </div>
              <p className="pl-3.5 text-sm font-semibold text-navy">{formatarValor(totalAdimplente)}</p>

              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                <span className="text-navy-soft">Inadimplentes ({inadimplentes.length})</span>
              </div>
              <p className="pl-3.5 text-sm font-semibold text-navy">{formatarValor(totalInadimplente)}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-rule pt-4">
            <Link href="/admin/cobrancas" className={atalhoClasses}>
              Ver honorários
            </Link>
          </div>
        </div>
      </div>

      {/* Linha 2 — prazos e tarefas: o que precisa de atenção operacional. */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className={cardClasses}>
          <div className="flex items-start justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
              Obrigações da Semana
            </p>
            <CardIconBadge
              chave="prazos"
              className={temObrigacaoUrgente ? 'bg-red-50 text-red-600' : 'bg-navy/5 text-navy'}
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <p
              className={`font-display text-3xl font-semibold ${
                temObrigacaoUrgente ? 'text-red-600' : 'text-navy'
              }`}
            >
              {listaPrazos.length}
            </p>
            {temObrigacaoUrgente && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-red-700">
                <IconAlerta className="h-3 w-3" />
                Urgente
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-navy-soft">Vencendo nos próximos 7 dias</p>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-rule pt-4">
            <Link href="/admin/prazos" className={atalhoClasses}>
              Ver Kanban
            </Link>
            <Link href="/admin/prazos?visao=calendario" className={atalhoClasses}>
              Ver Calendário
            </Link>
          </div>
        </div>

        <div className={cardClasses}>
          <div className="mb-4 flex items-start justify-between">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-navy">
              Próximos Vencimentos
              {listaPrazos.length > 0 && (
                <span className="rounded-full bg-paper-dim px-2 py-0.5 font-mono text-[11px] font-normal text-navy-soft">
                  {listaPrazos.length}
                </span>
              )}
            </h2>
            <CardIconBadge chave="prazos" className="bg-navy/5 text-navy" />
          </div>

          {listaPrazos.length === 0 ? (
            <p className="text-sm text-navy-soft">Nenhuma obrigação vencendo essa semana. 🎉</p>
          ) : (
            <ul className="divide-y divide-rule">
              {listaPrazos.map((prazo) => (
                <li key={prazo.id} className="flex items-center gap-3 py-3 text-sm">
                  <IconeCard chave="prazos" className="h-4 w-4 shrink-0 text-navy-soft" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-navy">
                      {prazo.obrigacoes_acessorias?.nome ?? '—'}
                    </p>
                    <p className="truncate text-xs text-navy-soft">{prazo.clientes?.nome_empresa ?? '—'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-[12px] text-navy-soft">
                      {formatarData(prazo.data_vencimento)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${
                        statusBadgePrazo[prazo.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                      }`}
                    >
                      {statusLabelPrazo[prazo.status] ?? prazo.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tarefas Pendentes (contagem) e Tarefas em Aberto (lista) mostravam a
            mesma informação em dois lugares — fundidos num card só: a contagem
            grande no topo, a lista logo abaixo. */}
        <div className={cardClasses}>
          <div className="flex items-start justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
              Tarefas Pendentes
            </p>
            <CardIconBadge chave="tarefas" className="bg-blue-50 text-blue-600" />
          </div>
          <p className="mt-4 font-display text-3xl font-semibold text-navy">{tarefasPendentesTotal ?? 0}</p>

          <div className="mt-4 border-t border-rule pt-4">
            {listaTarefas.length === 0 ? (
              <p className="text-sm text-navy-soft">Nenhuma tarefa pendente. 🎉</p>
            ) : (
              <ul className="divide-y divide-rule">
                {listaTarefas.map((tarefa) => (
                  <li key={tarefa.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <IconeCard chave="tarefas" className="h-4 w-4 shrink-0 text-navy-soft" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-navy">{tarefa.titulo}</p>
                      {tarefa.clientes?.nome_empresa && (
                        <p className="truncate text-xs text-navy-soft">{tarefa.clientes.nome_empresa}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[12px] text-navy-soft">
                      {formatarData(tarefa.data_limite)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-rule pt-4">
            <Link href="/admin/tarefas/nova" className={atalhoClasses}>
              Nova tarefa
            </Link>
            <Link href="/admin/tarefas" className={atalhoClasses}>
              Ver todas
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

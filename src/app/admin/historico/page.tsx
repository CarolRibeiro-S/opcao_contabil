import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const POR_PAGINA = 50

const ACOES_FILTRO = [
  { valor: '', label: 'Todas' },
  { valor: 'criou', label: 'Criou' },
  { valor: 'editou', label: 'Editou' },
  { valor: 'ativou', label: 'Ativou' },
  { valor: 'inativou', label: 'Inativou' },
  { valor: 'excluiu', label: 'Excluiu' },
]

const ACAO_INFO: Record<
  string,
  { texto: string; badgeLabel: string; badgeClasses: string; dotClasses: string }
> = {
  criou: {
    texto: 'criou',
    badgeLabel: 'Criou',
    badgeClasses: 'border border-[#c8e2a1] bg-[#eef7e0] text-[#4f8f2a]',
    dotClasses: 'bg-lime',
  },
  editou: {
    texto: 'editou',
    badgeLabel: 'Editou',
    badgeClasses: 'border border-blue-200 bg-blue-50 text-blue-700',
    dotClasses: 'bg-blue-500',
  },
  ativou: {
    texto: 'ativou',
    badgeLabel: 'Ativou',
    badgeClasses: 'border border-[#c8e2a1] bg-[#eef7e0] text-[#4f8f2a]',
    dotClasses: 'bg-lime',
  },
  inativou: {
    texto: 'inativou',
    badgeLabel: 'Inativou',
    badgeClasses: 'border border-amber-200 bg-amber-50 text-amber-700',
    dotClasses: 'bg-amber-500',
  },
  excluiu: {
    texto: 'excluiu',
    badgeLabel: 'Excluiu',
    badgeClasses: 'border border-red-200 bg-red-50 text-red-700',
    dotClasses: 'bg-red-500',
  },
}

const ENTIDADE_ARTIGO: Record<string, string> = {
  cliente: 'o cliente',
}

type RegistroHistorico = {
  id: string
  usuario_nome: string
  acao: string
  entidade: string
  entidade_nome: string
  created_at: string
}

function formatarDataHora(iso: string) {
  // created_at vem em UTC do banco; convertido aqui só pra exibição.
  const data = new Date(iso)
  const dataFormatada = data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const horaFormatada = data.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dataFormatada} às ${horaFormatada}`
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; acao?: string }>
}) {
  const { pagina: paginaParam, acao: acaoParam } = await searchParams
  const pagina = Math.max(1, Number(paginaParam) || 1)
  const acaoFiltro = ACOES_FILTRO.some((item) => item.valor === acaoParam) ? (acaoParam ?? '') : ''

  const supabase = await createClient()

  const inicio = (pagina - 1) * POR_PAGINA
  const fim = inicio + POR_PAGINA - 1

  let query = supabase
    .from('historico_atividades')
    .select('id, usuario_nome, acao, entidade, entidade_nome, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(inicio, fim)

  if (acaoFiltro) {
    query = query.eq('acao', acaoFiltro)
  }

  const { data: registros, count } = await query.returns<RegistroHistorico[]>()

  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA))

  function hrefComFiltro(novaPagina: number) {
    const params = new URLSearchParams()
    if (acaoFiltro) params.set('acao', acaoFiltro)
    if (novaPagina > 1) params.set('pagina', String(novaPagina))
    const querystring = params.toString()
    return `/admin/historico${querystring ? `?${querystring}` : ''}`
  }

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">Histórico</h1>
      <p className="mb-8 text-sm text-navy-soft">
        Registro de ações realizadas no painel administrativo — por enquanto, só ações de Clientes.
      </p>

      {/* mt-[37px]: alinha o início do conteúdo com a linha azul de
          navegação da sidebar (161px de altura do cabeçalho da sidebar,
          menos os 124px que padding-top do <main> (64px) + o bloco de
          título+descrição (60px: h1 + colapso de 8px + parágrafo) já
          ocupam — mesmo cálculo já usado no Dashboard Financeiro). */}
      <form action="/admin/historico" className="mt-[37px] mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor="acao" className="font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
          Tipo de ação
        </label>
        <select
          id="acao"
          name="acao"
          defaultValue={acaoFiltro}
          className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-sm text-charcoal outline-none focus:border-lime"
        >
          {ACOES_FILTRO.map((item) => (
            <option key={item.valor} value={item.valor}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-[3px] border-[1.3px] border-navy px-4 py-1.5 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper"
        >
          Filtrar
        </button>
      </form>

      {!registros || registros.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhuma atividade registrada ainda.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-rule bg-white">
          {registros.map((item) => {
            const info = ACAO_INFO[item.acao]
            const artigo = ENTIDADE_ARTIGO[item.entidade] ?? item.entidade

            return (
              <li
                key={item.id}
                className="flex items-start gap-3 border-b border-rule px-4 py-3 last:border-b-0"
              >
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${info?.dotClasses ?? 'bg-navy-soft'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-charcoal">
                    <span className="font-semibold text-navy">{item.usuario_nome}</span>{' '}
                    {info?.texto ?? item.acao} {artigo}{' '}
                    <span className="font-semibold text-navy">{item.entidade_nome}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-navy-soft">
                    {formatarDataHora(item.created_at)}
                  </p>
                </div>
                <span
                  className={`h-fit shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${
                    info?.badgeClasses ?? 'border border-rule bg-paper-dim text-navy-soft'
                  }`}
                >
                  {info?.badgeLabel ?? item.acao}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <Link
            href={hrefComFiltro(Math.max(1, pagina - 1))}
            className={`font-semibold text-navy-soft transition-colors duration-200 hover:text-navy ${
              pagina <= 1 ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            ← Anterior
          </Link>
          <span className="text-navy-soft">
            Página {pagina} de {totalPaginas}
          </span>
          <Link
            href={hrefComFiltro(Math.min(totalPaginas, pagina + 1))}
            className={`font-semibold text-navy-soft transition-colors duration-200 hover:text-navy ${
              pagina >= totalPaginas ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            Próxima →
          </Link>
        </div>
      )}
    </div>
  )
}

// Paleta de cores/badges conhecida pras 8 categorias de despesa que já
// existiam fixas no código antes de categorias virarem dados do banco
// (categorias_financeiras). Categorias novas criadas pelo usuário via
// SelectCategoria não têm entrada aqui e caem no estilo neutro padrão —
// ver obterEstiloCategoria().
export const CATEGORIAS_DESPESA = [
  {
    chave: 'pessoal',
    label: 'Pessoal',
    badgeClasses: 'border border-blue-200 bg-blue-50 text-blue-700',
    cor: 'var(--chart-blue)',
  },
  {
    chave: 'ocupacao',
    label: 'Ocupação',
    badgeClasses: 'border border-purple-200 bg-purple-50 text-purple-700',
    cor: 'var(--chart-purple)',
  },
  {
    chave: 'administrativas',
    label: 'Administrativas',
    badgeClasses: 'border border-gray-300 bg-gray-100 text-gray-700',
    cor: 'var(--chart-gray)',
  },
  {
    chave: 'tecnologia',
    label: 'Tecnologia',
    badgeClasses: 'border border-navy/20 bg-navy/5 text-navy',
    cor: 'var(--chart-navy)',
  },
  {
    chave: 'marketing',
    label: 'Marketing',
    badgeClasses: 'border border-lime/40 bg-lime/15 text-success',
    cor: 'var(--lime)',
  },
  {
    chave: 'financeiras',
    label: 'Financeiras',
    badgeClasses: 'border border-amber-200 bg-amber-50 text-amber-700',
    cor: 'var(--warning)',
  },
  {
    chave: 'impostos',
    label: 'Impostos',
    badgeClasses: 'border border-red-200 bg-red-50 text-red-700',
    cor: 'var(--chart-red)',
  },
  {
    chave: 'outras',
    label: 'Outras',
    badgeClasses: 'border border-rule bg-paper-dim text-navy-soft',
    cor: 'var(--chart-stone)',
  },
] as const

function normalizarNomeCategoria(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

const CATEGORIA_POR_NOME_NORMALIZADO = new Map(
  CATEGORIAS_DESPESA.map((categoria) => [normalizarNomeCategoria(categoria.label), categoria])
)

const ESTILO_CATEGORIA_PADRAO = {
  badgeClasses: 'border border-rule bg-paper-dim text-navy-soft',
  cor: 'var(--chart-stone)',
}

// Categorias agora vêm de categorias_financeiras e podem ser criadas
// livremente pelo usuário (combobox "+ Criar categoria"), então a busca de
// estilo é por nome (normalizado, sem acento/maiúscula) em vez de uma chave
// fixa — com fallback neutro pra qualquer categoria fora da paleta conhecida.
export function obterEstiloCategoria(nome: string | null | undefined) {
  if (!nome) return ESTILO_CATEGORIA_PADRAO
  return CATEGORIA_POR_NOME_NORMALIZADO.get(normalizarNomeCategoria(nome)) ?? ESTILO_CATEGORIA_PADRAO
}

export const STATUS_DESPESA_BADGE: Record<string, string> = {
  em_aberto: 'border border-amber-200 bg-amber-50 text-amber-700',
  pago: 'border border-success-border bg-success-bg text-success',
}

export const STATUS_DESPESA_LABEL: Record<string, string> = {
  em_aberto: 'Em Aberto',
  pago: 'Pago',
}

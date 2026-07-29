export const CATEGORIAS_DESPESA = [
  { chave: 'pessoal', label: 'Pessoal', badgeClasses: 'border border-blue-200 bg-blue-50 text-blue-700' },
  {
    chave: 'ocupacao',
    label: 'Ocupação',
    badgeClasses: 'border border-purple-200 bg-purple-50 text-purple-700',
  },
  {
    chave: 'administrativas',
    label: 'Administrativas',
    badgeClasses: 'border border-gray-300 bg-gray-100 text-gray-700',
  },
  {
    chave: 'tecnologia',
    label: 'Tecnologia',
    badgeClasses: 'border border-navy/20 bg-navy/5 text-navy',
  },
  {
    chave: 'marketing',
    label: 'Marketing',
    badgeClasses: 'border border-lime/40 bg-lime/15 text-[#4f8f2a]',
  },
  {
    chave: 'financeiras',
    label: 'Financeiras',
    badgeClasses: 'border border-amber-200 bg-amber-50 text-amber-700',
  },
  { chave: 'impostos', label: 'Impostos', badgeClasses: 'border border-red-200 bg-red-50 text-red-700' },
  { chave: 'outras', label: 'Outras', badgeClasses: 'border border-rule bg-paper-dim text-navy-soft' },
] as const

export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number]['chave']

export const CATEGORIA_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS_DESPESA.map((categoria) => [categoria.chave, categoria.label])
)

export const CATEGORIA_BADGE: Record<string, string> = Object.fromEntries(
  CATEGORIAS_DESPESA.map((categoria) => [categoria.chave, categoria.badgeClasses])
)

// Cores em hex (não classes Tailwind) pra usar em atributos SVG (fill/stroke),
// que não conseguem resolver classes utilitárias — só valores CSS diretos.
export const CATEGORIA_COR_GRAFICO: Record<string, string> = {
  pessoal: '#3b82f6',
  ocupacao: '#a855f7',
  administrativas: '#6b7280',
  tecnologia: '#16234a',
  marketing: '#8dc63f',
  financeiras: '#f59e0b',
  impostos: '#ef4444',
  outras: '#a8a29e',
}

export const STATUS_DESPESA_BADGE: Record<string, string> = {
  em_aberto: 'border border-amber-200 bg-amber-50 text-amber-700',
  pago: 'border border-[#c8e2a1] bg-[#eef7e0] text-[#4f8f2a]',
}

export const STATUS_DESPESA_LABEL: Record<string, string> = {
  em_aberto: 'Em Aberto',
  pago: 'Pago',
}

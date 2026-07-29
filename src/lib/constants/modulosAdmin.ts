export const MODULOS_ADMIN = [
  { chave: 'dashboard', label: 'Dashboard' },
  { chave: 'clientes', label: 'Clientes' },
  { chave: 'envio-mensal', label: 'Envio de Docs Mensais' },
  { chave: 'tarefas', label: 'Tarefas' },
  { chave: 'prazos', label: 'Prazos' },
  { chave: 'cobrancas', label: 'Honorários Contábeis' },
  { chave: 'equipe', label: 'Equipe' },
] as const

export type ModuloAdmin = (typeof MODULOS_ADMIN)[number]['chave']

export const CHAVES_MODULOS_ADMIN: string[] = MODULOS_ADMIN.map((modulo) => modulo.chave)

const TAMANHO_MAXIMO_NOME = 100

// Só para o CAMINHO físico no Supabase Storage (a "key"), que só aceita
// ASCII — o nome original (com acento, do jeito que o usuário vê) continua
// sendo salvo à parte, sem alteração, no banco (nome_arquivo ou
// equivalente).
export function sanitizarNomeArquivo(nome: string): string {
  const ultimoPonto = nome.lastIndexOf('.')
  const temExtensao = ultimoPonto > 0 && ultimoPonto < nome.length - 1

  const base = temExtensao ? nome.slice(0, ultimoPonto) : nome
  const extensao = temExtensao ? nome.slice(ultimoPonto) : ''

  const baseSanitizada = base
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, TAMANHO_MAXIMO_NOME)

  const extensaoSanitizada = extensao
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9.]/g, '')

  return `${baseSanitizada || 'arquivo'}${extensaoSanitizada}`
}

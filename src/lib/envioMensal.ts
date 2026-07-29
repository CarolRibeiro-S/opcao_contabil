export const TIPOS_PADRAO = ['ISS', 'PIS', 'COFINS', 'INSS', 'FGTS', 'IRPJ', 'CSSL', 'DAS']

const PALAVRAS_CHAVE_TIPO: { palavra: string; tipo: string }[] = [
  { palavra: 'COFINS', tipo: 'COFINS' },
  { palavra: 'PIS', tipo: 'PIS' },
  { palavra: 'DAS', tipo: 'DAS' },
  { palavra: 'ISS', tipo: 'ISS' },
  { palavra: 'INSS', tipo: 'INSS' },
  { palavra: 'FGTS', tipo: 'FGTS' },
  { palavra: 'IRPJ', tipo: 'IRPJ' },
  { palavra: 'CSSL', tipo: 'CSSL' },
  { palavra: 'CSLL', tipo: 'CSSL' },
]

export function normalizarTexto(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}

export function detectarTipo(nomeArquivo: string): string | null {
  const normalizado = normalizarTexto(nomeArquivo)

  for (const { palavra, tipo } of PALAVRAS_CHAVE_TIPO) {
    if (normalizado.includes(palavra)) {
      return tipo
    }
  }

  return null
}

export function detectarClienteId(
  nomeArquivo: string,
  clientes: { id: string; apelido: string | null }[]
): string | null {
  const normalizado = normalizarTexto(nomeArquivo)

  for (const cliente of clientes) {
    if (!cliente.apelido) continue
    const apelidoNormalizado = normalizarTexto(cliente.apelido)
    if (apelidoNormalizado && normalizado.includes(apelidoNormalizado)) {
      return cliente.id
    }
  }

  return null
}

function somenteDigitos(texto: string) {
  return texto.replace(/\D/g, '')
}

export function detectarClientePorCnpj(
  cnpjCompleto: string | null,
  cnpjRaiz: string | null,
  clientes: { id: string; cnpj_cpf: string | null }[]
): string | null {
  if (cnpjCompleto) {
    for (const cliente of clientes) {
      if (!cliente.cnpj_cpf) continue
      if (somenteDigitos(cliente.cnpj_cpf) === cnpjCompleto) return cliente.id
    }
  }

  if (cnpjRaiz) {
    for (const cliente of clientes) {
      if (!cliente.cnpj_cpf) continue
      if (somenteDigitos(cliente.cnpj_cpf).slice(0, 8) === cnpjRaiz) return cliente.id
    }
  }

  return null
}

export type ClienteOption = {
  id: string
  nome_empresa: string
  apelido: string | null
  email: string | null
  cnpj_cpf: string | null
}

export type ImpostoVencimento = {
  tipo: string
  dataVencimento: string
}

export type OrigemDeteccao = 'cnpj' | 'apelido' | 'manual'

export type ArquivoRevisado = {
  id: string
  file: File
  clienteId: string
  tipo: string
  dataVencimento: string
  origemDeteccao: OrigemDeteccao
}

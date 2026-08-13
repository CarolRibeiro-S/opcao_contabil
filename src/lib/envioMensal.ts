export const TIPOS_PADRAO = [
  'ISS',
  'PIS',
  'COFINS',
  'INSS',
  'FGTS',
  'IRPJ',
  'CSSL',
  'DAS',
  'IRRF',
  'DARF',
  'Parcelamento',
  'Honorários',
  'Taxas',
  'Extrato do Simples Nacional',
  'Documentos da Empresa',
]

// Tipos de documento informativo, sem data de vencimento (ex: extrato do
// Simples Nacional, balanço, alteração contratual). Usado pra Etapa 2 não
// exigir vencimento e pra Etapa 3 não listar "TIPO - VENCIMENTO" no e-mail
// pra esses arquivos.
export const TIPOS_SEM_VENCIMENTO = ['Extrato do Simples Nacional', 'Documentos da Empresa']

// "PARCELA" (cobre "PARCELA" e "PARCELAMENTO" como substring) fica de fora
// dessa lista e é checada à parte, com prioridade máxima, em detectarTipo —
// assim um nome como "PARCELAMENTO INSS" vira Parcelamento, não INSS. As
// demais palavras aqui (incluindo PGFN, GDF, RECEITA, que também indicam
// parcelamento mas sem a palavra "parcela" no nome) seguem a ordem normal:
// primeiro match no array vence.
const PALAVRA_PARCELA = 'PARCELA'
const TIPO_PARCELAMENTO = 'Parcelamento'

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
  { palavra: 'HONORARIO', tipo: 'Honorários' },
  { palavra: 'TAXA', tipo: 'Taxas' },
  { palavra: 'IRRF', tipo: 'IRRF' },
  { palavra: 'DARF', tipo: 'DARF' },
  { palavra: 'PGFN', tipo: TIPO_PARCELAMENTO },
  { palavra: 'GDF', tipo: TIPO_PARCELAMENTO },
  { palavra: 'RECEITA', tipo: TIPO_PARCELAMENTO },
  { palavra: 'EXTRATO', tipo: 'Extrato do Simples Nacional' },
  { palavra: 'BALANCO', tipo: 'Documentos da Empresa' },
  { palavra: 'ALTERACAO', tipo: 'Documentos da Empresa' },
  { palavra: 'CNPJ', tipo: 'Documentos da Empresa' },
  { palavra: 'CFDF', tipo: 'Documentos da Empresa' },
  { palavra: 'DRE', tipo: 'Documentos da Empresa' },
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

  if (normalizado.includes(PALAVRA_PARCELA)) {
    return TIPO_PARCELAMENTO
  }

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

// Palavras genéricas de razão social que não ajudam a identificar um
// cliente específico (aparecem em qualquer empresa) — ficam de fora da
// comparação por nome em detectarClientePorNomeEmpresa.
const PALAVRAS_GENERICAS_NOME_EMPRESA = [
  'LTDA',
  'ME',
  'EPP',
  'SS',
  'EIRELI',
  'MEI',
  'DE',
  'DA',
  'DO',
  'E',
  'COMERCIO',
  'SERVICOS',
  'CONSULTORIA',
]

// Terceira tentativa de reconhecimento (depois de CNPJ e apelido): quebra
// o nome_empresa em palavras, descarta as genéricas/curtas, e vê se alguma
// palavra restante aparece no nome do arquivo.
export function detectarClientePorNomeEmpresa(
  nomeArquivo: string,
  clientes: { id: string; nome_empresa: string }[]
): string | null {
  const normalizado = normalizarTexto(nomeArquivo)

  for (const cliente of clientes) {
    const palavras = cliente.nome_empresa
      .split(/\s+/)
      .map((palavra) => normalizarTexto(palavra))
      .filter((palavra) => palavra.length >= 4 && !PALAVRAS_GENERICAS_NOME_EMPRESA.includes(palavra))

    if (palavras.some((palavra) => normalizado.includes(palavra))) {
      return cliente.id
    }
  }

  return null
}

export type ProfissionalOption = {
  clienteId: string
  nome: string
}

// Título/prefixo comum na frente do nome cadastrado do profissional (ex:
// "Dr. Newton Braga") que normalmente não aparece no nome do arquivo —
// removido antes de comparar. Case insensitive, com ou sem ponto.
const REGEX_TITULO_PROFISSIONAL = /^(dr|dra|sr|sra)\.?\s+/i

// Quarta tentativa: pra clínicas, o nome do médico/profissional às vezes
// aparece no nome do arquivo em vez do nome da clínica. Mesma ideia de
// detectarClientePorNomeEmpresa — quebra em palavras e compara cada uma —
// porque o arquivo costuma trazer só um pedaço do nome (ex: só o
// sobrenome), não o nome completo cadastrado com título.
export function detectarClientePorProfissional(
  nomeArquivo: string,
  profissionais: ProfissionalOption[]
): string | null {
  const normalizado = normalizarTexto(nomeArquivo)

  for (const profissional of profissionais) {
    const nomeSemTitulo = profissional.nome.replace(REGEX_TITULO_PROFISSIONAL, '')

    const palavras = nomeSemTitulo
      .split(/\s+/)
      .map((palavra) => normalizarTexto(palavra))
      .filter((palavra) => palavra.length >= 3)

    if (palavras.some((palavra) => normalizado.includes(palavra))) {
      return profissional.clienteId
    }
  }

  return null
}

export type DeteccaoClientePorNome = {
  clienteId: string
  origemDeteccao: 'apelido' | 'nome' | 'medico' | 'manual'
}

// Roda as três tentativas baseadas só no nome do arquivo, na ordem de
// prioridade: apelido → nome da empresa/palavra → nome de profissional.
// CNPJ (a mais confiável) roda à parte, depois da extração do PDF, e tem
// prioridade sobre o resultado daqui.
export function detectarClientePorNomeArquivo(
  nomeArquivo: string,
  clientes: ClienteOption[],
  profissionais: ProfissionalOption[]
): DeteccaoClientePorNome {
  const porApelido = detectarClienteId(nomeArquivo, clientes)
  if (porApelido) return { clienteId: porApelido, origemDeteccao: 'apelido' }

  const porNomeEmpresa = detectarClientePorNomeEmpresa(nomeArquivo, clientes)
  if (porNomeEmpresa) return { clienteId: porNomeEmpresa, origemDeteccao: 'nome' }

  const porProfissional = detectarClientePorProfissional(nomeArquivo, profissionais)
  if (porProfissional) return { clienteId: porProfissional, origemDeteccao: 'medico' }

  return { clienteId: '', origemDeteccao: 'manual' }
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

export type OrigemDeteccao = 'cnpj' | 'apelido' | 'nome' | 'medico' | 'manual'

export type ArquivoRevisado = {
  id: string
  file: File
  clienteId: string
  tipo: string
  dataVencimento: string
  origemDeteccao: OrigemDeteccao
}

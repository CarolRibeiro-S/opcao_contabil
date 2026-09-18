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
  'Contra Cheque',
  'Pró-Labore',
]

// Tipos de documento informativo, sem data de vencimento (ex: extrato do
// Simples Nacional, balanço, alteração contratual). Usado pra Etapa 2 não
// exigir vencimento e pra Etapa 3 não listar "TIPO - VENCIMENTO" no e-mail
// pra esses arquivos.
export const TIPOS_SEM_VENCIMENTO = [
  'Extrato do Simples Nacional',
  'Documentos da Empresa',
  'Contra Cheque',
  'Pró-Labore',
]

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
  { palavra: 'CERTIDAO', tipo: 'Documentos da Empresa' },
  // Uma entrada só cobre "PRO LABORE", "PRO-LABORE" e "PROLABORE" — o nome
  // do arquivo já passa por normalizarTexto antes da comparação, que
  // remove espaço/hífen/acento e deixa tudo maiúsculo, então as três
  // grafias caem no mesmo "PROLABORE" comparado aqui. Uma entrada literal
  // com espaço nunca daria match (normalizado nunca tem espaço).
  { palavra: 'PROLABORE', tipo: 'Pró-Labore' },
  // Mesma lógica: "Contra Cheque", "CONTRACHEQUE" e "contra-cheque" caem
  // todas em "CONTRACHEQUE" depois do normalizarTexto.
  { palavra: 'CONTRACHEQUE', tipo: 'Contra Cheque' },
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

// Tokeniza mantendo fronteira de palavra (espaço, hífen, ponto, underline
// etc.) — diferente de normalizarTexto (usada em detectarTipo acima), que
// remove TODOS os separadores e junta tudo num blob só. Aqui a fronteira
// importa de verdade: sem ela, "AUTO" (E M Rodrigues) batia como substring
// solta dentro de "AUTOS" (Asa Norte), mandando o arquivo pro cliente
// errado — ver investigação do caso Asa Norte/E M Rodrigues.
export function tokenizar(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .split(/[^a-zA-Z0-9]+/)
    .filter((token) => token.length > 0)
}

// "consulta" pode ser uma palavra só (palavra de nome_empresa) ou uma
// frase de vários tokens (apelido composto, ex: "Instituto Vascular") — os
// dois lados viram "|TOKEN|TOKEN|...|" e a comparação é substring desse
// texto com delimitadores nas pontas. Isso garante que só bate token
// inteiro (ou sequência de tokens inteiros), nunca pedaço de token.
export function contemComoPalavraInteira(tokensAlvo: string[], consulta: string): boolean {
  const tokensConsulta = tokenizar(consulta)
  if (tokensConsulta.length === 0) return false
  return `|${tokensAlvo.join('|')}|`.includes(`|${tokensConsulta.join('|')}|`)
}

// clientes.apelidos_extra: campo de texto simples com variantes/abreviações
// adicionais separadas por vírgula (ex: "INST VASCULAR, IVB") — escolhido
// em vez de uma tabela nova porque resolve o problema (permitir mais de um
// jeito de reconhecer o mesmo cliente) sem exigir join extra nem migration
// pesada; o volume esperado por cliente é pequeno (poucas variantes), então
// uma lista separada por vírgula é simples de cadastrar e de ler. Cada
// variante é comparada como frase inteira, igual o apelido principal.
function todasVariantesApelido(cliente: { apelido: string | null; apelidos_extra?: string | null }): string[] {
  const variantes = [cliente.apelido, ...(cliente.apelidos_extra?.split(',') ?? [])]
  return variantes.map((variante) => variante?.trim()).filter((variante): variante is string => !!variante)
}

// Palavras genéricas de razão social que não ajudam a identificar um
// cliente específico (aparecem em qualquer empresa) — ficam de fora da
// comparação por nome em candidatosPorNomeEmpresa.
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

// Cada uma das três funções abaixo devolve TODOS os clientes que bateram
// (não só o primeiro) — quem decide "detecção única" vs "ambígua, cai pra
// seleção manual" é resolverCandidatos, chamada por
// detectarClientePorNomeArquivo. Antes, a primeira palavra que batesse na
// ordem alfabética da lista vencia sozinha — foi assim que Angioprime
// "roubou" arquivos do Instituto Vascular (as duas têm "VASCULAR" no nome,
// Angioprime só vinha primeiro no alfabeto).
export function candidatosPorApelido(
  nomeArquivo: string,
  clientes: { id: string; apelido: string | null; apelidos_extra?: string | null }[]
): string[] {
  const tokensArquivo = tokenizar(nomeArquivo)
  const encontrados = new Set<string>()

  for (const cliente of clientes) {
    const variantes = todasVariantesApelido(cliente)
    if (variantes.some((variante) => contemComoPalavraInteira(tokensArquivo, variante))) {
      encontrados.add(cliente.id)
    }
  }

  return [...encontrados]
}

// Extraída de candidatosPorNomeEmpresa (abaixo) pra ser reaproveitada por
// quem precisa saber SÓ as palavras significativas de um nome_empresa, sem
// rodar a detecção inteira — ver identificarClientesEmParesAmbiguos em
// lib/sugestaoApelidos.ts.
export function palavrasSignificativasNomeEmpresa(nomeEmpresa: string): string[] {
  return nomeEmpresa.split(/\s+/).filter((palavra) => {
    const normalizada = normalizarTexto(palavra)
    return normalizada.length >= 4 && !PALAVRAS_GENERICAS_NOME_EMPRESA.includes(normalizada)
  })
}

// Segunda tentativa de reconhecimento (depois do apelido): quebra o
// nome_empresa em palavras, descarta as genéricas/curtas, e vê se alguma
// palavra restante aparece no arquivo como palavra INTEIRA (não substring).
export function candidatosPorNomeEmpresa(
  nomeArquivo: string,
  clientes: { id: string; nome_empresa: string }[]
): string[] {
  const tokensArquivo = tokenizar(nomeArquivo)
  const encontrados = new Set<string>()

  for (const cliente of clientes) {
    const palavrasSignificativas = palavrasSignificativasNomeEmpresa(cliente.nome_empresa)

    if (palavrasSignificativas.some((palavra) => contemComoPalavraInteira(tokensArquivo, palavra))) {
      encontrados.add(cliente.id)
    }
  }

  return [...encontrados]
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
// candidatosPorNomeEmpresa — quebra em palavras e compara cada uma como
// palavra inteira — porque o arquivo costuma trazer só um pedaço do nome
// (ex: só o sobrenome), não o nome completo cadastrado com título.
function candidatosPorProfissional(nomeArquivo: string, profissionais: ProfissionalOption[]): string[] {
  const tokensArquivo = tokenizar(nomeArquivo)
  const encontrados = new Set<string>()

  for (const profissional of profissionais) {
    const nomeSemTitulo = profissional.nome.replace(REGEX_TITULO_PROFISSIONAL, '')
    const palavras = nomeSemTitulo.split(/\s+/).filter((palavra) => normalizarTexto(palavra).length >= 3)

    if (palavras.some((palavra) => contemComoPalavraInteira(tokensArquivo, palavra))) {
      encontrados.add(profissional.clienteId)
    }
  }

  return [...encontrados]
}

// Meses (por extenso e abreviado) e palavras genéricas de arquivo/tipo de
// documento — nenhuma delas ajuda a identificar QUAL cliente é (aparecem
// em arquivo de qualquer cliente), então ficam de fora das frases
// candidatas a apelido extra em extrairFrasesCandidatas.
const MESES_RUIDO_ARQUIVO = [
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO',
  'NOVEMBRO', 'DEZEMBRO', 'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ',
]

const PALAVRAS_GENERICAS_ARQUIVO = [
  'PDF', 'DOC', 'DOCX', 'JPG', 'JPEG', 'PNG', 'GUIA', 'COMPROVANTE', 'BOLETO', 'ARQUIVO', 'DOCUMENTO',
  'MES', 'COMPETENCIA', 'ANEXO', 'COPIA', 'VERSAO', 'FINAL', 'ATUALIZADO', 'NOVO', 'SCAN', 'DIGITALIZADO',
]

const PALAVRAS_CHAVE_TIPO_SET = new Set(PALAVRAS_CHAVE_TIPO.map((item) => item.palavra))

function ehTokenRuidoParaApelido(token: string): boolean {
  if (/^\d+$/.test(token)) return true // datas, anos, números soltos
  if (token.length < 3) return true
  if (token === PALAVRA_PARCELA) return true
  if (PALAVRAS_CHAVE_TIPO_SET.has(token)) return true
  if (MESES_RUIDO_ARQUIVO.includes(token)) return true
  if (PALAVRAS_GENERICAS_ARQUIVO.includes(token)) return true
  if (PALAVRAS_GENERICAS_NOME_EMPRESA.includes(token)) return true
  return false
}

// Extrai frases candidatas a apelido extra de UM nome de arquivo — usado
// tanto pra sugerir a partir do histórico de uploads (relatório de
// sugestões) quanto pro "aprender com a correção manual" (oferecer salvar
// como apelido extra assim que o admin resolve um arquivo ambíguo/manual
// na hora). Agrupa tokens não-ruído que aparecem consecutivos no arquivo
// (ex: "INST VASCULAR" antes de "GUIA DO INSS") como a frase mais
// específica, e cada palavra individual como alternativa mais curta —
// quem decide qual usar é sempre uma pessoa revisando a sugestão, nunca
// aplicado sozinho.
export function extrairFrasesCandidatas(nomeArquivo: string): string[] {
  const tokens = tokenizar(nomeArquivo)
  const frases: string[] = []
  const vistos = new Set<string>()

  function adicionar(frase: string) {
    if (!vistos.has(frase)) {
      vistos.add(frase)
      frases.push(frase)
    }
  }

  let inicioRun = 0
  for (let i = 0; i <= tokens.length; i++) {
    const fimDoRun = i === tokens.length || ehTokenRuidoParaApelido(tokens[i])
    if (fimDoRun) {
      const run = tokens.slice(inicioRun, i)
      if (run.length > 0) {
        adicionar(run.slice(0, Math.min(run.length, 3)).join(' '))
        for (const token of run) adicionar(token)
      }
      inicioRun = i + 1
    }
  }

  return frases
}

// Antes de salvar uma frase como apelido extra de um cliente (seja vinda
// da tela de sugestões ou do "aprender com a correção manual"), confirma
// que ela não vira uma AMBIGUIDADE NOVA — de dois jeitos diferentes, não
// só um:
//
// 1) Bate no apelido/apelidos_extra de OUTRO cliente também — conflito
//    direto na mesma etapa.
// 2) Bate no NOME_EMPRESA de outro cliente — esse é o mais traiçoeiro:
//    apelido tem prioridade máxima e resolve sozinho assim que encontra 1
//    candidato, sem nunca chegar a testar nome_empresa pelos OUTROS
//    clientes. Então uma frase como "VASCULAR" (parte do nome_empresa da
//    Angioprime) parece "sem conflito" se só checarmos contra apelidos —
//    mas far a esse mesmo apelido "vencer" por atalho um arquivo que,
//    sem ele, teria corretamente caído em ambíguo contra a Angioprime.
//    Isso reintroduziria exatamente o erro silencioso que motivou toda
//    essa investigação (Instituto Vascular x Angioprime) — por isso os
//    dois testes rodam sempre juntos.
export function avaliarConflitoApelidoExtra(
  frase: string,
  clienteIdAlvo: string,
  clientes: ClienteOption[]
): { conflita: boolean; comClientes: { id: string; nome: string }[] } {
  const clientesSimulados = clientes.map((cliente) =>
    cliente.id === clienteIdAlvo
      ? { ...cliente, apelidos_extra: [cliente.apelidos_extra, frase].filter(Boolean).join(', ') }
      : cliente
  )

  const candidatosApelido = candidatosPorApelido(frase, clientesSimulados)
  const candidatosNome = candidatosPorNomeEmpresa(frase, clientes)

  const idsConflitantes = new Set(
    [...candidatosApelido, ...candidatosNome].filter((id) => id !== clienteIdAlvo)
  )

  const comClientes = [...idsConflitantes].map((id) => ({
    id,
    nome: clientes.find((cliente) => cliente.id === id)?.nome_empresa ?? id,
  }))

  return { conflita: comClientes.length > 0, comClientes }
}

export type OrigemDeteccaoPorNome = 'apelido' | 'nome' | 'medico' | 'manual' | 'ambiguo'

export type CandidatoAmbiguo = { clienteId: string; nomeEmpresa: string }

export type DeteccaoClientePorNome = {
  clienteId: string
  origemDeteccao: OrigemDeteccaoPorNome
  // Só preenchido quando origemDeteccao === 'ambiguo' — lista os clientes
  // que bateram na mesma etapa, pro aviso na tela mostrar quem são as
  // opções em vez de só dizer "não identificado".
  candidatosAmbiguos?: CandidatoAmbiguo[]
}

// Decide o que fazer com os candidatos de UMA etapa (apelido, nome ou
// profissional): 0 = passa pra próxima etapa: 1 = detecção confiável de
// verdade: 2+ = ambíguo — NÃO escolhe sozinho (antes, o primeiro por ordem
// alfabética da lista vencia; foi assim que Angioprime "roubou" arquivos
// do Instituto Vascular, só porque vem antes no alfabeto). Ambíguo também
// pula direto pra fora, sem tentar as etapas seguintes — se apelido já
// achou 2 clientes diferentes, não faz sentido nome_empresa "desempatar".
function resolverCandidatos(
  candidatos: string[],
  origem: 'apelido' | 'nome' | 'medico',
  clientes: ClienteOption[]
): DeteccaoClientePorNome | null {
  if (candidatos.length === 0) return null

  if (candidatos.length === 1) {
    return { clienteId: candidatos[0], origemDeteccao: origem }
  }

  return {
    clienteId: '',
    origemDeteccao: 'ambiguo',
    candidatosAmbiguos: candidatos.map((id) => ({
      clienteId: id,
      nomeEmpresa: clientes.find((cliente) => cliente.id === id)?.nome_empresa ?? id,
    })),
  }
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
  const porApelido = resolverCandidatos(candidatosPorApelido(nomeArquivo, clientes), 'apelido', clientes)
  if (porApelido) return porApelido

  const porNomeEmpresa = resolverCandidatos(candidatosPorNomeEmpresa(nomeArquivo, clientes), 'nome', clientes)
  if (porNomeEmpresa) return porNomeEmpresa

  const porProfissional = resolverCandidatos(candidatosPorProfissional(nomeArquivo, profissionais), 'medico', clientes)
  if (porProfissional) return porProfissional

  return { clienteId: '', origemDeteccao: 'manual' }
}

export function somenteDigitos(texto: string) {
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
  // Variantes/abreviações extras do apelido, separadas por vírgula (ex:
  // "INST VASCULAR, IVB") — null pra praticamente todo mundo hoje, só
  // preenchido manualmente pros clientes que precisarem (ver
  // todasVariantesApelido acima). Não preenchido em massa de propósito —
  // fica pra revisão manual de quais clientes realmente precisam.
  apelidos_extra: string | null
  email: string | null
  cnpj_cpf: string | null
}

export type ImpostoVencimento = {
  tipo: string
  dataVencimento: string
}

export type OrigemDeteccao = 'cnpj' | 'apelido' | 'nome' | 'medico' | 'manual' | 'ambiguo'

export type ArquivoRevisado = {
  id: string
  file: File
  clienteId: string
  tipo: string
  dataVencimento: string
  origemDeteccao: OrigemDeteccao
  // clienteId nunca muda depois de setado por detecção AUTOMÁTICA (nome de
  // arquivo ou CNPJ extraído do PDF) — troca manual no dropdown não mexe
  // aqui. É contra isso que a Etapa 2 compara pra mostrar o aviso de
  // possível seleção errada (ver AvisoDivergencia em EnvioMensalArquivos.tsx).
  clienteIdDetectado: string
  // CNPJ lido de dentro do PDF (se algum foi encontrado) — usado pro
  // segundo tipo de aviso: bate com o CNPJ do cliente atualmente
  // selecionado (automático ou manual)?
  cnpjCompletoExtraido: string | null
  cnpjRaizExtraido: string | null
  // Só preenchido quando origemDeteccao === 'ambiguo' (ver
  // resolverCandidatos) — lista os clientes que bateram no arquivo, pro
  // aviso na tela mostrar as opções em vez de só "não identificado".
  candidatosAmbiguos?: CandidatoAmbiguo[]
}

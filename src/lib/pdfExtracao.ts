import { PDFParse } from 'pdf-parse'

const PALAVRAS_CHAVE_CNPJ = ['CPF/CNPJ', 'CNPJ', 'Empregador']

// Todas em maiúsculo/sem acento porque são comparadas contra o texto já
// passado por normalizarParaBusca (ver mais abaixo) — documentos de fontes
// diferentes (Receita Federal, GDF/ISSNet, eCAC, sistemas municipais) usam
// capitalização e abreviações bem inconsistentes entre si.
const PALAVRAS_CHAVE_VENCIMENTO = [
  'PAGAR ESTE DOCUMENTO ATE',
  'DATA DE VENCIMENTO',
  'DATA LIMITE',
  'PRAZO PARA PAGAMENTO',
  'PAGAVEL ATE',
  'RECOLHER ATE',
  'PAGAR ATE',
  'VENCTO',
  'VENC.',
  'VENCIMENTO',
]

const REGEX_CNPJ_FORMATADO = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/
const REGEX_CNPJ_14_DIGITOS = /(?<!\d)\d{14}(?!\d)/
const REGEX_CNPJ_RAIZ = /(?<!\d)\d{2}\.\d{3}\.\d{3}(?!\/)(?!\d)/
const REGEX_DATA = /\d{2}\/\d{2}\/\d{4}/

// Raiz que cobre "vence", "vencimento", "vencimentos", "vencido" etc. —
// usada só no fallback genérico de data (buscarDataPorProximidadeDeLinha).
const RAIZ_VENCIMENTO = 'VENC'
const PALAVRA_PAGAR = 'PAGAR'

function somenteDigitos(texto: string) {
  return texto.replace(/\D/g, '')
}

// Maiúsculo + sem acento, mantendo pontuação/espaços (preciso deles pra
// casar frases como "Vencimento:" e pra não desalinhar o recorte da data).
// Como só compara dígitos/letras (a REGEX_DATA não tem acento), dá pra usar
// esse mesmo texto normalizado tanto pra achar a palavra-chave quanto pra
// extrair a data, sem precisar mapear posições de volta pro texto original.
function normalizarParaBusca(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase()
}

function buscarProximoAKeyword(texto: string, palavras: string[], regex: RegExp, janela: number) {
  for (const palavra of palavras) {
    let indice = texto.indexOf(palavra)

    // Percorre TODAS as ocorrências da palavra-chave, não só a primeira —
    // ela pode aparecer antes num cabeçalho/legenda sem data por perto.
    while (indice !== -1) {
      const trecho = texto.slice(indice + palavra.length, indice + palavra.length + janela)
      const match = trecho.match(regex)
      if (match) return match[0]

      indice = texto.indexOf(palavra, indice + palavra.length)
    }
  }

  return null
}

// Fallback quando nenhuma frase-chave específica bateu: procura qualquer
// data dd/mm/aaaa na mesma linha ou até 2 linhas de distância de qualquer
// ocorrência de "VENC" (vence/vencimento/vencimentos/vencido) ou "PAGAR".
function buscarDataPorProximidadeDeLinha(texto: string): string | null {
  const linhas = texto.split(/\r?\n/)

  for (let i = 0; i < linhas.length; i++) {
    if (!linhas[i].includes(RAIZ_VENCIMENTO) && !linhas[i].includes(PALAVRA_PAGAR)) continue

    const inicio = Math.max(0, i - 2)
    const fim = Math.min(linhas.length, i + 3)
    const trecho = linhas.slice(inicio, fim).join(' ')
    const match = trecho.match(REGEX_DATA)
    if (match) return match[0]
  }

  return null
}

// Diagnóstico temporário: quando a data não é encontrada, registra nos
// logs (visíveis na Vercel) um trecho ao redor da primeira ocorrência de
// "vencim"/"pagar" no PDF real, pra dar pra ver por que o formato não
// bateu em documentos de produção. Remover depois de confirmado.
function logarFalhaDeteccaoData(textoBusca: string) {
  const indice = textoBusca.search(/VENC|PAGAR/)

  if (indice === -1) {
    console.error('[extrairDadosPdf] Data de vencimento não encontrada; texto não contém "vencim"/"pagar".')
    return
  }

  const trecho = textoBusca.slice(Math.max(0, indice - 100), indice + 200)
  console.error('[extrairDadosPdf] Data de vencimento não encontrada. Trecho ao redor de "vencim"/"pagar":', trecho)
}

function converterDataParaIso(dataBr: string) {
  const [dia, mes, ano] = dataBr.split('/')
  return `${ano}-${mes}-${dia}`
}

export type DadosExtraidosPdf = {
  cnpjCompleto: string | null
  cnpjRaiz: string | null
  dataVencimento: string | null
  textoExtraido: string
}

export async function extrairDadosPdf(buffer: Buffer): Promise<DadosExtraidosPdf> {
  const parser = new PDFParse({ data: buffer })

  try {
    const resultado = await parser.getText()
    const texto = resultado.text ?? ''

    let cnpjCompleto: string | null = null

    const cnpjFormatadoProximo = buscarProximoAKeyword(texto, PALAVRAS_CHAVE_CNPJ, REGEX_CNPJ_FORMATADO, 80)
    if (cnpjFormatadoProximo) {
      cnpjCompleto = somenteDigitos(cnpjFormatadoProximo)
    } else {
      const cnpj14Proximo = buscarProximoAKeyword(texto, PALAVRAS_CHAVE_CNPJ, REGEX_CNPJ_14_DIGITOS, 80)
      if (cnpj14Proximo) {
        cnpjCompleto = somenteDigitos(cnpj14Proximo)
      } else {
        const matchGlobal = texto.match(REGEX_CNPJ_FORMATADO)
        if (matchGlobal) cnpjCompleto = somenteDigitos(matchGlobal[0])
      }
    }

    let cnpjRaiz: string | null = null
    if (!cnpjCompleto) {
      const raizProxima = buscarProximoAKeyword(texto, PALAVRAS_CHAVE_CNPJ, REGEX_CNPJ_RAIZ, 80)
      if (raizProxima) cnpjRaiz = somenteDigitos(raizProxima)
    }

    let dataVencimento: string | null = null
    const textoBusca = normalizarParaBusca(texto)

    const dataPorFraseChave = buscarProximoAKeyword(textoBusca, PALAVRAS_CHAVE_VENCIMENTO, REGEX_DATA, 40)
    if (dataPorFraseChave) {
      dataVencimento = converterDataParaIso(dataPorFraseChave)
    } else {
      const dataPorProximidade = buscarDataPorProximidadeDeLinha(textoBusca)
      if (dataPorProximidade) dataVencimento = converterDataParaIso(dataPorProximidade)
    }

    if (!dataVencimento) {
      logarFalhaDeteccaoData(textoBusca)
    }

    return { cnpjCompleto, cnpjRaiz, dataVencimento, textoExtraido: texto }
  } finally {
    await parser.destroy()
  }
}

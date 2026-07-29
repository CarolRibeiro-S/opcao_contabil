import { PDFParse } from 'pdf-parse'

const PALAVRAS_CHAVE_CNPJ = ['CPF/CNPJ', 'CNPJ', 'Empregador']

const PALAVRAS_CHAVE_VENCIMENTO = [
  'Pagar este documento até',
  'Data de Vencimento',
  'Pagar até',
  'Vencimento',
]

const REGEX_CNPJ_FORMATADO = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/
const REGEX_CNPJ_14_DIGITOS = /(?<!\d)\d{14}(?!\d)/
const REGEX_CNPJ_RAIZ = /(?<!\d)\d{2}\.\d{3}\.\d{3}(?!\/)(?!\d)/
const REGEX_DATA = /\d{2}\/\d{2}\/\d{4}/

function somenteDigitos(texto: string) {
  return texto.replace(/\D/g, '')
}

function buscarProximoAKeyword(texto: string, palavras: string[], regex: RegExp, janela: number) {
  for (const palavra of palavras) {
    const indice = texto.indexOf(palavra)
    if (indice === -1) continue

    const trecho = texto.slice(indice + palavra.length, indice + palavra.length + janela)
    const match = trecho.match(regex)
    if (match) return match[0]
  }

  return null
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
    const dataProxima = buscarProximoAKeyword(texto, PALAVRAS_CHAVE_VENCIMENTO, REGEX_DATA, 40)
    if (dataProxima) dataVencimento = converterDataParaIso(dataProxima)

    return { cnpjCompleto, cnpjRaiz, dataVencimento, textoExtraido: texto }
  } finally {
    await parser.destroy()
  }
}

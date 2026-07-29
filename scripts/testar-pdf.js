const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

async function main() {
  const caminhoArgumento = process.argv[2]

  if (!caminhoArgumento) {
    console.error('Uso: npm run testar-pdf -- "caminho/do/arquivo.pdf"')
    process.exit(1)
  }

  const caminhoAbsoluto = path.resolve(process.cwd(), caminhoArgumento)

  if (!fs.existsSync(caminhoAbsoluto)) {
    console.error(`Arquivo não encontrado: ${caminhoAbsoluto}`)
    process.exit(1)
  }

  const buffer = fs.readFileSync(caminhoAbsoluto)

  const caminhoModulo = path.join(__dirname, '..', 'src', 'lib', 'pdfExtracao.ts')
  const { extrairDadosPdf } = await import(pathToFileURL(caminhoModulo).href)

  const resultado = await extrairDadosPdf(buffer)

  console.log('='.repeat(70))
  console.log(`ARQUIVO: ${caminhoAbsoluto}`)
  console.log('='.repeat(70))

  console.log('\n--- TEXTO BRUTO EXTRAÍDO (sem processamento) ---\n')
  console.log(resultado.textoExtraido || '(nenhum texto extraído)')

  console.log('\n' + '='.repeat(70))
  console.log('CAMPOS IDENTIFICADOS PELA EXTRAÇÃO')
  console.log('='.repeat(70))
  console.log(`cnpjCompleto:   ${resultado.cnpjCompleto ?? '(não encontrado)'}`)
  console.log(`cnpjRaiz:       ${resultado.cnpjRaiz ?? '(não encontrado)'}`)
  console.log(`dataVencimento: ${resultado.dataVencimento ?? '(não encontrado)'}`)
  console.log('='.repeat(70))
}

main().catch((err) => {
  console.error('Erro ao processar o PDF:', err)
  process.exit(1)
})

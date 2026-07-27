import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function normalizar(valor: unknown) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
}

function normalizarNomeMedico(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
}

function paraNumero(valor: unknown): number {
  if (typeof valor === 'number') return valor
  if (typeof valor !== 'string') return 0

  const limpo = valor.replace(/[^\d,.-]/g, '').trim()
  if (!limpo) return 0

  if (limpo.includes(',')) {
    const numero = Number(limpo.replace(/\./g, '').replace(',', '.'))
    return Number.isNaN(numero) ? 0 : numero
  }

  const numero = Number(limpo)
  return Number.isNaN(numero) ? 0 : numero
}

const CABECALHOS_IGNORADOS = new Set(['NF', 'SERIE', 'SÉRIE', 'VALOR', 'CLIENTE'])

function ehCabecalhoDeParada(valor: string) {
  return valor === '' || valor === 'TOTAL' || valor.includes('STATUS') || valor === 'OK'
}

export async function POST(request: Request) {
  const supabaseAuth = await createClient()

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { data: profile } = await supabaseAuth.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const formData = await request.formData()
  const arquivo = formData.get('arquivo')
  const clienteId = formData.get('clienteId')
  const competencia = formData.get('competencia')

  if (
    !(arquivo instanceof File) ||
    typeof clienteId !== 'string' ||
    typeof competencia !== 'string' ||
    !clienteId ||
    !competencia
  ) {
    return NextResponse.json(
      { error: 'Dados incompletos. Selecione a competência e o arquivo.' },
      { status: 400 }
    )
  }

  const arrayBuffer = await arquivo.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível ler o arquivo. Confirme que é um .xlsx válido.' },
      { status: 400 }
    )
  }

  const planilha = workbook.Sheets[workbook.SheetNames[0]]
  const linhas: unknown[][] = XLSX.utils.sheet_to_json(planilha, { header: 1, defval: '' })

  // Localiza o cabeçalho da tabela de faturamento (linha com "CLIENTE" na 1ª coluna e "VALOR" em alguma coluna)
  let indiceCabecalho = -1
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    if (normalizar(linha[0]) === 'CLIENTE' && linha.some((celula) => normalizar(celula) === 'VALOR')) {
      indiceCabecalho = i
      break
    }
  }

  if (indiceCabecalho === -1) {
    return NextResponse.json(
      { error: 'Não encontramos a linha de cabeçalho (CLIENTE / VALOR) na planilha.' },
      { status: 400 }
    )
  }

  const cabecalho = linhas[indiceCabecalho].map(normalizar)
  const colValor = cabecalho.indexOf('VALOR')

  // Colunas de médico: depois de VALOR, até a primeira coluna vazia ou de total/status
  const colunasMedicos: { indice: number; nome: string }[] = []
  for (let c = colValor + 1; c < cabecalho.length; c++) {
    const rotulo = cabecalho[c]
    if (ehCabecalhoDeParada(rotulo)) break
    if (CABECALHOS_IGNORADOS.has(rotulo)) continue
    colunasMedicos.push({ indice: c, nome: String(linhas[indiceCabecalho][c]).trim() })
  }

  if (colunasMedicos.length === 0) {
    return NextResponse.json({ error: 'Não encontramos colunas de médico na planilha.' }, { status: 400 })
  }

  // Soma o faturamento por médico, linha a linha, até a linha de totais/vazia
  const faturamentoPorMedico = new Map<string, number>()
  for (const coluna of colunasMedicos) faturamentoPorMedico.set(coluna.nome, 0)

  for (let r = indiceCabecalho + 1; r < linhas.length; r++) {
    const linha = linhas[r]
    const primeiraCelula = normalizar(linha[0])

    if (primeiraCelula === 'TOTAIS' || primeiraCelula === 'TOTAL' || primeiraCelula === '') {
      break
    }

    for (const coluna of colunasMedicos) {
      const numero = paraNumero(linha[coluna.indice])
      if (numero > 0) {
        faturamentoPorMedico.set(coluna.nome, (faturamentoPorMedico.get(coluna.nome) ?? 0) + numero)
      }
    }
  }

  // Localiza a segunda tabela (impostos): linha com "IMPOSTO TOTAL" em alguma coluna
  let indiceCabecalhoImposto = -1
  let colImpostoInicio = -1
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    const idx = linha.findIndex((celula) => normalizar(celula) === 'IMPOSTO TOTAL')
    if (idx !== -1) {
      indiceCabecalhoImposto = i
      colImpostoInicio = idx
      break
    }
  }

  const impostoPorMedicoNormalizado = new Map<string, number>()

  if (indiceCabecalhoImposto !== -1) {
    const linhaCabecalhoImposto = linhas[indiceCabecalhoImposto]
    const colunasMedicosImposto: { indice: number; nome: string }[] = []

    for (let c = colImpostoInicio + 1; c < linhaCabecalhoImposto.length; c++) {
      const rotulo = normalizar(linhaCabecalhoImposto[c])
      if (rotulo === '') break
      colunasMedicosImposto.push({ indice: c, nome: String(linhaCabecalhoImposto[c]).trim() })
    }

    let indiceTotalImpostos = -1
    for (let r = indiceCabecalhoImposto + 1; r < linhas.length; r++) {
      if (normalizar(linhas[r][0]) === 'TOTAL DE IMPOSTOS') {
        indiceTotalImpostos = r
        break
      }
    }

    if (indiceTotalImpostos !== -1) {
      const linhaTotalImpostos = linhas[indiceTotalImpostos]
      for (const coluna of colunasMedicosImposto) {
        impostoPorMedicoNormalizado.set(
          normalizarNomeMedico(coluna.nome),
          paraNumero(linhaTotalImpostos[coluna.indice])
        )
      }
    }
  }

  // Busca os profissionais já cadastrados para esse cliente
  const supabaseAdmin = createAdminClient()

  const { data: profissionaisExistentes } = await supabaseAdmin
    .from('profissionais_clinica')
    .select('id, nome')
    .eq('cliente_id', clienteId)

  const profissionaisPorNomeNormalizado = new Map<string, string>()
  for (const profissional of profissionaisExistentes ?? []) {
    profissionaisPorNomeNormalizado.set(normalizarNomeMedico(profissional.nome), profissional.id)
  }

  const medicosNaoEncontrados: string[] = []
  const resultados: { nome: string; faturamento: number; impostoDevido: number }[] = []

  for (const coluna of colunasMedicos) {
    const faturamento = faturamentoPorMedico.get(coluna.nome) ?? 0
    if (faturamento <= 0) continue

    const nomeNormalizado = normalizarNomeMedico(coluna.nome)
    const impostoDevido = impostoPorMedicoNormalizado.get(nomeNormalizado) ?? 0

    let profissionalId = profissionaisPorNomeNormalizado.get(nomeNormalizado)

    if (!profissionalId) {
      const { data: novoProfissional, error: criarError } = await supabaseAdmin
        .from('profissionais_clinica')
        .insert({ cliente_id: clienteId, nome: coluna.nome })
        .select('id')
        .single()

      if (criarError || !novoProfissional?.id) {
        continue
      }

      profissionalId = novoProfissional.id
      profissionaisPorNomeNormalizado.set(nomeNormalizado, novoProfissional.id)
      medicosNaoEncontrados.push(coluna.nome)
    }

    if (!profissionalId) continue

    await supabaseAdmin.from('apuracoes_profissionais').upsert(
      {
        profissional_id: profissionalId,
        competencia: `${competencia}-01`,
        faturamento,
        imposto_devido: impostoDevido,
      },
      { onConflict: 'profissional_id,competencia' }
    )

    resultados.push({ nome: coluna.nome, faturamento, impostoDevido })
  }

  const faturamentoTotal = resultados.reduce((soma, item) => soma + item.faturamento, 0)

  return NextResponse.json({
    medicosProcessados: resultados.length,
    faturamentoTotal,
    medicosNaoEncontrados,
    resultados,
  })
}

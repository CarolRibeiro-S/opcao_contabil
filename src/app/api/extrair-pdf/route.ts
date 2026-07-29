import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extrairDadosPdf, type DadosExtraidosPdf } from '@/lib/pdfExtracao'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const formData = await request.formData()
  const idsRaw = formData.get('ids')
  const debug = formData.get('debug') === 'true'

  if (typeof idsRaw !== 'string') {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  let ids: string[]
  try {
    ids = JSON.parse(idsRaw)
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const resultados: Record<string, DadosExtraidosPdf | Omit<DadosExtraidosPdf, 'textoExtraido'> | null> = {}

  for (const id of ids) {
    const arquivo = formData.get(id)

    if (!(arquivo instanceof File)) {
      resultados[id] = null
      continue
    }

    try {
      const buffer = Buffer.from(await arquivo.arrayBuffer())
      const dados = await extrairDadosPdf(buffer)

      if (debug) {
        resultados[id] = dados
      } else {
        const { cnpjCompleto, cnpjRaiz, dataVencimento } = dados
        resultados[id] = { cnpjCompleto, cnpjRaiz, dataVencimento }
      }
    } catch {
      resultados[id] = null
    }
  }

  return NextResponse.json({ resultados })
}

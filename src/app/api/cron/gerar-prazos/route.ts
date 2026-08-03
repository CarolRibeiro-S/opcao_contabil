import { NextResponse } from 'next/server'
import { gerarPrazosAutomaticos } from '@/lib/gerarPrazos'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization')

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resumo = await gerarPrazosAutomaticos()
    return NextResponse.json(resumo)
  } catch (erro) {
    console.error('[cron/gerar-prazos] Erro ao gerar prazos:', erro)
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido.'
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}

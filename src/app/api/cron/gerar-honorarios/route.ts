import { NextResponse } from 'next/server'
import { gerarHonorariosAutomaticos } from '@/lib/gerarHonorarios'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization')

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resumo = await gerarHonorariosAutomaticos()
    return NextResponse.json(resumo)
  } catch (erro) {
    console.error('[cron/gerar-honorarios] Erro ao gerar honorários:', erro)
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido.'
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}

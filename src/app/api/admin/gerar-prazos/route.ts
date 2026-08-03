import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gerarPrazosAutomaticos } from '@/lib/gerarPrazos'

export const dynamic = 'force-dynamic'

// Mesma lógica exata do cron semanal (gerarPrazosAutomaticos), só que
// disparada manualmente pelo admin em vez de pelo CRON_SECRET — que nunca
// pode chegar ao navegador. Guard idêntico ao resto das rotas admin
// (sessão + role). Segura de rodar quantas vezes quiser: idempotente, não
// duplica prazos já gerados.
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

  // Corpo é opcional — só existe quando o admin usa a geração retroativa
  // pra uma competência específica em vez do uso normal do dia a dia.
  const body = await request.json().catch(() => null)
  const competencia = typeof body?.competencia === 'string' ? body.competencia : undefined

  if (competencia !== undefined && !/^\d{4}-\d{2}$/.test(competencia)) {
    return NextResponse.json({ error: 'Competência inválida — use o formato AAAA-MM.' }, { status: 400 })
  }

  try {
    const resumo = await gerarPrazosAutomaticos(competencia)
    return NextResponse.json(resumo)
  } catch (erro) {
    console.error('[admin/gerar-prazos] Erro ao gerar prazos:', erro)
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido.'
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}

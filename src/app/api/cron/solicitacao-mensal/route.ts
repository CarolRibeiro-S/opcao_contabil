import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { determinarEnviosDoDia, competenciaDoMes } from '@/lib/solicitacaoMensal'
import { emailSolicitacaoMensal } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

type ClienteRow = {
  id: string
  nome_empresa: string
  email: string | null
  emite_notas_fiscais: boolean | null
  possui_empregados: boolean | null
}

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization')

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hoje = new Date()
  const envios = determinarEnviosDoDia(hoje)

  if (envios.length === 0) {
    return NextResponse.json({ enviosDoDia: [], enviados: 0, pulados: 0, semEmail: 0 })
  }

  const supabase = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)
  const competencia = competenciaDoMes(hoje)
  const linkPortal = `${process.env.NEXT_PUBLIC_SITE_URL}/portal`

  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('id, nome_empresa, email, emite_notas_fiscais, possui_empregados')
    .eq('status', 'ativo')
    .returns<ClienteRow[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let enviados = 0
  let pulados = 0
  let semEmail = 0

  for (const tipo of envios) {
    for (const cliente of clientes ?? []) {
      if (!cliente.email) {
        semEmail += 1
        continue
      }

      const { data: jaEnviado } = await supabase
        .from('envios_solicitacao_mensal')
        .select('id')
        .eq('cliente_id', cliente.id)
        .eq('competencia', competencia)
        .eq('tipo', tipo)
        .maybeSingle()

      if (jaEnviado) {
        pulados += 1
        continue
      }

      const { subject, html } = emailSolicitacaoMensal({
        nomeCliente: cliente.nome_empresa,
        tipo,
        competencia,
        emiteNotasFiscais: cliente.emite_notas_fiscais ?? true,
        possuiEmpregados: !!cliente.possui_empregados,
        linkPortal,
      })

      const { error: emailError } = await resend.emails.send({
        from: 'naoresponda@opcaocontabilbsb.com.br',
        to: cliente.email,
        subject,
        html,
      })

      if (emailError) continue

      await supabase.from('envios_solicitacao_mensal').insert({
        cliente_id: cliente.id,
        competencia,
        tipo,
      })

      enviados += 1
    }
  }

  return NextResponse.json({ enviosDoDia: envios, enviados, pulados, semEmail })
}

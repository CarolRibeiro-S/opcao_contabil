import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('--- 1. Confirmando os 4 clientes e seus e-mails ---')
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome_empresa, apelido, email')
    .in('apelido', ['Wnf', 'Wnr', 'Wgks', 'Calebe'])
  console.log(clientes)

  if (!clientes || clientes.length === 0) {
    console.log('Não achei os clientes pelo apelido — abortando.')
    return
  }

  const emails = new Set(clientes.map((c) => c.email))
  console.log('\nE-mails distintos entre eles:', emails)

  console.log('\n--- 2. documentos_clientes desses 4 clientes, mais recentes primeiro ---')
  const { data: documentos } = await supabase
    .from('documentos_clientes')
    .select('cliente_id, nome_arquivo, tipo, enviado_em, enviado_por')
    .in('cliente_id', clientes.map((c) => c.id))
    .order('enviado_em', { ascending: false })
    .limit(50)

  for (const doc of documentos ?? []) {
    const nomeCliente = clientes.find((c) => c.id === doc.cliente_id)?.apelido
    console.log(`${doc.enviado_em} | ${nomeCliente?.padEnd(8)} | ${doc.nome_arquivo}`)
  }

  console.log(`\nTotal de documentos encontrados: ${documentos?.length ?? 0}`)

  console.log('\n--- 3. Datas distintas de enviado_em (pra achar "ontem" sem adivinhar o dia exato) ---')
  const datas = new Set((documentos ?? []).map((d) => d.enviado_em?.slice(0, 10)))
  console.log(datas)
}

main()

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('--- email_eventos registrados em 18/08 (qualquer origem) ---')
  const { data, error } = await supabase
    .from('email_eventos')
    .select('*')
    .gte('criado_em', '2026-08-18T00:00:00')
    .lte('criado_em', '2026-08-19T23:59:59')
    .order('criado_em', { ascending: true })

  if (error) {
    console.log('Erro (a tabela existe?):', error.message)
    return
  }

  console.log(data)
  console.log(`\nTotal: ${data?.length ?? 0} evento(s) nesse período.`)

  console.log('\n--- Todos os eventos já registrados, de qualquer data (visão geral) ---')
  const { data: todos } = await supabase.from('email_eventos').select('*').order('criado_em', { ascending: false }).limit(20)
  console.log(todos)
}

main()

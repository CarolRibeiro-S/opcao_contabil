import { createClient } from '@/lib/supabase/server'

export async function getClienteAtual() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, cliente: null }
  }

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome_empresa')
    .eq('profile_id', user.id)
    .single()

  return { supabase, cliente }
}

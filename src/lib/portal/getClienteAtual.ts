import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const COOKIE_CLIENTE_ATIVO = 'cliente_ativo_id'

export type ClienteOption = { id: string; nome_empresa: string }

// Um login pode ter mais de uma empresa vinculada (mesmo profile_id em
// várias linhas de "clientes" — dono com múltiplas empresas, ver
// api/clientes/convidar/route.ts). O RLS já suporta isso nativamente
// (testado: a policy filtra por "cliente_id IN (SELECT id FROM clientes
// WHERE profile_id = auth.uid())", não por igualdade 1:1), então a única
// coisa que faltava era não usar mais .single() aqui.
//
// "Ativo" é decidido por um cookie (COOKIE_CLIENTE_ATIVO, gravado por
// api/portal/trocar-empresa quando o cliente troca de empresa no seletor).
// Sem cookie ainda (ou cookie apontando pra uma empresa que não é mais
// dele), cai no primeiro da lista — pro caso comum de 1 empresa só, isso
// dá exatamente o mesmo resultado de antes.
export async function getClienteAtual() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, cliente: null, todosClientes: [] as ClienteOption[] }
  }

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome_empresa')
    .eq('profile_id', user.id)
    .order('nome_empresa', { ascending: true })
    .returns<ClienteOption[]>()

  const todosClientes = clientes ?? []

  if (todosClientes.length === 0) {
    return { supabase, cliente: null, todosClientes }
  }

  const cookieStore = await cookies()
  const clienteAtivoId = cookieStore.get(COOKIE_CLIENTE_ATIVO)?.value

  const cliente = todosClientes.find((candidato) => candidato.id === clienteAtivoId) ?? todosClientes[0]

  return { supabase, cliente, todosClientes }
}

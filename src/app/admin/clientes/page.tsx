import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientesTable from '@/components/admin/ClientesTable'
import VerificarRegimeButton from '@/components/admin/VerificarRegimeButton'

// Descobre quem já concluiu o convite (criou senha, logou pelo menos uma
// vez) via auth.admin.listUsers() — a Auth Admin API do Supabase, não uma
// function SQL. Só funciona com a service role key (createAdminClient,
// nunca exposta ao browser), então não passa nem perto do PostgREST/RPC —
// diferente de uma function pública ficar exposta sem querer (o problema
// do is_admin() que motivou esse cuidado), aqui não existe rota de API
// nenhuma pra proteger: o Admin SDK só roda server-side, com a chave que só
// o backend tem. last_sign_in_at nulo = convite pendente (nunca terminou
// de criar a senha); preenchido = acesso confirmado.
//
// Pagina em blocos de 1000 (bem acima do total de usuários do sistema
// hoje) e continua enquanto a página vier cheia, só por segurança caso o
// número de usuários cresça muito no futuro.
async function buscarUltimosLogins(): Promise<Map<string, boolean>> {
  const supabaseAdmin = createAdminClient()
  const mapa = new Map<string, boolean>()

  let pagina = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: pagina, perPage })

    if (error) {
      console.error('[admin/clientes] Erro ao buscar last_sign_in_at via Auth Admin API:', error)
      break
    }

    for (const usuario of data.users) {
      mapa.set(usuario.id, !!usuario.last_sign_in_at)
    }

    if (data.users.length < perPage) break
    pagina += 1
  }

  return mapa
}

export default async function ClientesPage() {
  const supabase = await createClient()

  const [{ data: clientes }, jaLogou] = await Promise.all([
    supabase
      .from('clientes')
      .select(
        'id, codigo_interno, cnpj_cpf, nome_empresa, tipo, segmento, status, responsavel, telefone, regime_tributario, profile_id'
      )
      .order('nome_empresa', { ascending: true }),
    buscarUltimosLogins(),
  ])

  const clientesComAcesso = (clientes ?? []).map((cliente) => ({
    ...cliente,
    acessoConfirmado: cliente.profile_id ? (jaLogou.get(cliente.profile_id) ?? false) : false,
  }))

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Clientes</h1>
        <div className="flex flex-wrap items-center gap-3">
          <VerificarRegimeButton
            clienteIds={clientesComAcesso
              .filter((cliente) => cliente.status === 'ativo')
              .map((cliente) => cliente.id)}
          />
          <Link
            href="/admin/clientes/novo"
            className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
          >
            + Novo Cliente
          </Link>
        </div>
      </div>

      {/* mt-[61px]: alinha o início do conteúdo com a linha azul de
          navegação da sidebar (161px de altura do cabeçalho da sidebar no
          Admin, menos os 100px que o padding-top do <main> (64px) + esta
          linha de título+botões (36px, dominada pelo botão "+ Novo
          Cliente", mais alto que o h1) já ocupam até aqui). */}
      <div className="mt-[61px]">
        {clientesComAcesso.length === 0 ? (
          <p className="text-sm text-navy-soft">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <ClientesTable clientes={clientesComAcesso} />
        )}
      </div>
    </div>
  )
}

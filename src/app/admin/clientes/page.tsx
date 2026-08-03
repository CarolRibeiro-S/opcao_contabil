import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ClientesTable from '@/components/admin/ClientesTable'
import VerificarRegimeButton from '@/components/admin/VerificarRegimeButton'

export default async function ClientesPage() {
  const supabase = await createClient()

  const { data: clientes } = await supabase
    .from('clientes')
    .select(
      'id, codigo_interno, cnpj_cpf, nome_empresa, tipo, segmento, status, responsavel, telefone, regime_tributario, profile_id'
    )
    .order('nome_empresa', { ascending: true })

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Clientes</h1>
        <div className="flex flex-wrap items-center gap-3">
          <VerificarRegimeButton
            clienteIds={(clientes ?? [])
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
        {!clientes || clientes.length === 0 ? (
          <p className="text-sm text-navy-soft">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <ClientesTable clientes={clientes} />
        )}
      </div>
    </div>
  )
}

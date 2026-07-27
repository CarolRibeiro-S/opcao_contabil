import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ClientesTable from '@/components/admin/ClientesTable'

export default async function ClientesPage() {
  const supabase = await createClient()

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome_empresa, tipo, segmento, status, telefone')
    .order('nome_empresa', { ascending: true })

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Clientes</h1>
        <Link
          href="/admin/clientes/novo"
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
        >
          + Novo Cliente
        </Link>
      </div>

      {!clientes || clientes.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum cliente cadastrado ainda.</p>
      ) : (
        <ClientesTable clientes={clientes} />
      )}
    </div>
  )
}

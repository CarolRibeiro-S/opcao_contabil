import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { gerarSugestoesApelidos } from '@/lib/sugestaoApelidos'
import SugestoesApelidosLista from '@/components/admin/SugestoesApelidosLista'
import type { ClienteOption } from '@/lib/envioMensal'

export default async function SugestoesApelidosPage() {
  const supabase = await createClient()

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome_empresa, apelido, apelidos_extra, email, cnpj_cpf')
    .eq('status', 'ativo')
    .returns<ClienteOption[]>()

  const clienteIds = (clientes ?? []).map((cliente) => cliente.id)

  const { data: documentos } =
    clienteIds.length > 0
      ? await supabase.from('documentos_clientes').select('cliente_id, nome_arquivo').in('cliente_id', clienteIds)
      : { data: [] }

  const sugestoes = gerarSugestoesApelidos(clientes ?? [], documentos ?? [])

  return (
    <div>
      <Link
        href="/admin/clientes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-navy"
      >
        ← Voltar
      </Link>

      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">Sugestões de apelido extra</h1>
      <p className="mb-8 max-w-2xl text-sm text-navy-soft">
        Baseado no histórico real de uploads do Envio Mensal, pros clientes que hoje têm risco de colisão de nome
        com outro cliente ativo. Nada é aplicado sozinho — revise, edite o texto se precisar, e aprove cada
        sugestão que fizer sentido.
      </p>

      {sugestoes.length === 0 ? (
        <p className="text-sm text-navy-soft">
          Nenhuma sugestão com histórico suficiente ainda — ou os clientes em risco de colisão não têm arquivos
          enviados no Envio Mensal ainda pra analisar o padrão de nomenclatura.
        </p>
      ) : (
        <SugestoesApelidosLista sugestoes={sugestoes} />
      )}
    </div>
  )
}

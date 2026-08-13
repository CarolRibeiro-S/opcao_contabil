import { getClienteAtual } from '@/lib/portal/getClienteAtual'
import MarcarVisualizado from '@/components/portal/MarcarVisualizado'
import { TIPO_ENVIO_LABEL, type TipoEnvioSolicitacaoMensal } from '@/lib/solicitacaoMensal'

type Envio = {
  id: string
  competencia: string
  tipo: TipoEnvioSolicitacaoMensal
  enviado_em: string
}

function formatarCompetencia(competencia: string) {
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano}`
}

// enviado_em vem em UTC do banco (timestamptz); precisa converter pro fuso
// de Brasília explicitamente — mesmo cuidado já usado em outras listagens
// que exibem timestamps (histórico, portal, comunicados).
function formatarDataHora(iso: string) {
  const data = new Date(iso)
  const dataFormatada = data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const horaFormatada = data.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dataFormatada} às ${horaFormatada}`
}

export default async function PortalSolicitacaoMensalPage() {
  const { supabase, cliente } = await getClienteAtual()

  if (!cliente) {
    return (
      <p className="text-sm text-navy-soft">
        Não encontramos um cadastro de cliente vinculado à sua conta.
      </p>
    )
  }

  const { data: envios } = await supabase
    .from('envios_solicitacao_mensal')
    .select('id, competencia, tipo, enviado_em')
    .eq('cliente_id', cliente.id)
    .order('enviado_em', { ascending: false })
    .returns<Envio[]>()

  const lista = envios ?? []

  return (
    <div>
      <MarcarVisualizado tabela="envios_solicitacao_mensal" clienteId={cliente.id} />

      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">Solicitação Mensal de Documentos</h1>
      <p className="mb-8 text-sm text-navy-soft">
        Todo mês pedimos por e-mail o XML das notas fiscais, extrato bancário, receitas e despesas, e
        informações de folha de pagamento. Aqui você acompanha as solicitações já enviadas — para mandar
        os documentos, responda diretamente o e-mail recebido (opcaocontabilbsb@gmail.com) ou envie pelo
        Portal em Comunicados.
      </p>

      <div>
        {lista.length === 0 ? (
          <p className="text-sm text-navy-soft">Nenhuma solicitação enviada ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-paper-dim">
                  <tr>
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                      Competência
                    </th>
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                      Tipo
                    </th>
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                      Enviado em
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((envio) => (
                    <tr key={envio.id} className="border-t border-rule">
                      <td className="px-4 py-3 font-medium text-navy">{formatarCompetencia(envio.competencia)}</td>
                      <td className="px-4 py-3 text-charcoal">{TIPO_ENVIO_LABEL[envio.tipo] ?? envio.tipo}</td>
                      <td className="px-4 py-3 text-charcoal">{formatarDataHora(envio.enviado_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

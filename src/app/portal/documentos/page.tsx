import { getClienteAtual } from '@/lib/portal/getClienteAtual'

type Documento = {
  id: string
  nome_arquivo: string
  tipo: string | null
  caminho_arquivo: string
  enviado_em: string | null
}

// enviado_em vem em UTC do banco (timestamptz); precisa converter pro fuso
// de Brasília explicitamente, senão o dia exibido pode variar conforme o
// fuso do servidor — mesmo cuidado já usado em formatarDataHora (histórico).
function formatarData(data: string | null) {
  if (!data) return '—'
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export default async function PortalDocumentosPage() {
  const { supabase, cliente } = await getClienteAtual()

  if (!cliente) {
    return (
      <p className="text-sm text-navy-soft">
        Não encontramos um cadastro de cliente vinculado à sua conta.
      </p>
    )
  }

  const { data: documentos } = await supabase
    .from('documentos_clientes')
    .select('id, nome_arquivo, tipo, caminho_arquivo, enviado_em')
    .eq('cliente_id', cliente.id)
    .returns<Documento[]>()

  const documentosComUrl = await Promise.all(
    (documentos ?? []).map(async (documento) => {
      const { data: signedUrlData } = await supabase.storage
        .from('documentos-clientes')
        .createSignedUrl(documento.caminho_arquivo, 3600)

      return { ...documento, signedUrl: signedUrlData?.signedUrl ?? null }
    })
  )

  return (
    <div>
      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Documentos</h1>

      {/* mt-[83px]: mesmo valor (e mesmo cálculo) já usado na grade de cards
          da Home do Portal — alinha o início do conteúdo com a linha azul
          de navegação da sidebar. Estrutura idêntica à da Home (h1 sozinho,
          1 linha, mb-8), então o mesmo valor se aplica sem recálculo. */}
      <div className="mt-[83px]">
        {documentosComUrl.length === 0 ? (
          <p className="text-sm text-navy-soft">Nenhum documento disponível ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule bg-white">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-paper-dim">
                <tr>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Arquivo
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Tipo
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Enviado em
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {documentosComUrl.map((documento) => (
                  <tr key={documento.id} className="border-t border-rule">
                    <td className="px-4 py-3 font-medium text-navy">{documento.nome_arquivo}</td>
                    <td className="px-4 py-3 text-charcoal">{documento.tipo ?? '—'}</td>
                    <td className="px-4 py-3 text-charcoal">{formatarData(documento.enviado_em)}</td>
                    <td className="px-4 py-3">
                      {documento.signedUrl ? (
                        <a
                          href={documento.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-navy-soft transition-colors duration-200 hover:text-navy"
                        >
                          Baixar
                        </a>
                      ) : (
                        <span className="text-xs text-navy-soft/60">indisponível</span>
                      )}
                    </td>
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

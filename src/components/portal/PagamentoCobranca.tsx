'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PagamentoCobranca({
  cobrancaId,
  formaPagamento,
  chavePix,
  boletoNomeArquivo,
  boletoCaminhoArquivo,
  mensagemPagamento,
  visualizadoEm,
}: {
  cobrancaId: string
  formaPagamento: string | null
  chavePix: string | null
  boletoNomeArquivo: string | null
  boletoCaminhoArquivo: string | null
  mensagemPagamento: string
  visualizadoEm: string | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    // Só marca uma vez — se já tem visualizado_em, o cliente já abriu essa
    // tela antes com essa mensagem visível, não precisa atualizar de novo.
    // Mesma lógica de "marcar como visto" já usada no ThreadComunicado.tsx
    // pro lado do admin, aqui adaptada pro lado do cliente.
    if (visualizadoEm) return

    async function marcarVisualizado() {
      const { error } = await supabase
        .from('cobrancas')
        .update({ visualizado_pelo_cliente_em: new Date().toISOString() })
        .eq('id', cobrancaId)

      if (error) {
        console.error('[PagamentoCobranca] Erro ao marcar honorário como visualizado:', error)
      } else {
        router.refresh()
      }
    }

    marcarVisualizado()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobrancaId])

  async function copiarChavePix() {
    if (!chavePix) return
    try {
      await navigator.clipboard.writeText(chavePix)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch (erro) {
      console.error('[PagamentoCobranca] Erro ao copiar chave PIX:', erro)
    }
  }

  async function baixarBoleto() {
    if (!boletoCaminhoArquivo) return
    const { data } = await supabase.storage.from('documentos-clientes').createSignedUrl(boletoCaminhoArquivo, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="rounded-lg border border-lime/40 bg-lime/10 p-4">
      <p className="text-sm text-navy">{mensagemPagamento}</p>

      {formaPagamento === 'pix' && chavePix && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-navy-soft">Chave PIX:</span>
          <code className="rounded bg-white px-2 py-1 font-mono text-xs text-navy">{chavePix}</code>
          <button
            type="button"
            onClick={copiarChavePix}
            className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
          >
            {copiado ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      )}

      {formaPagamento === 'boleto' && boletoCaminhoArquivo && (
        <div className="mt-3">
          <button
            type="button"
            onClick={baixarBoleto}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
          >
            📎 Baixar boleto{boletoNomeArquivo ? ` (${boletoNomeArquivo})` : ''}
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResponderComunicado({
  comunicadoId,
  clienteId,
}: {
  comunicadoId: string
  clienteId: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEnviar() {
    if (!arquivo) return

    setError('')
    setLoading(true)

    const caminhoArquivo = `${clienteId}/${arquivo.name}`

    const { error: uploadError } = await supabase.storage
      .from('documentos-clientes')
      .upload(caminhoArquivo, arquivo)

    if (uploadError) {
      setError('Não foi possível enviar o arquivo. Tente novamente.')
      setLoading(false)
      return
    }

    const extensao = arquivo.name.split('.').pop() ?? ''

    const { error: documentoError } = await supabase.from('documentos_clientes').insert({
      cliente_id: clienteId,
      comunicado_id: comunicadoId,
      nome_arquivo: arquivo.name,
      tipo: extensao,
      caminho_arquivo: caminhoArquivo,
    })

    if (documentoError) {
      setError('Arquivo enviado, mas houve um erro ao vincular ao comunicado.')
      setLoading(false)
      return
    }

    const { error: statusError } = await supabase
      .from('comunicados')
      .update({ status: 'respondido' })
      .eq('id', comunicadoId)

    if (statusError) {
      setError('Documento enviado, mas houve um erro ao atualizar o status.')
      setLoading(false)
      return
    }

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="mt-4 rounded-lg border border-rule bg-paper-dim p-4">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft">
        Responder com documento
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="block text-sm text-charcoal file:mr-3 file:rounded-[3px] file:border-[1.3px] file:border-navy file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy file:transition-colors file:duration-200 hover:file:bg-navy hover:file:text-paper"
        />
        <button
          type="button"
          onClick={handleEnviar}
          disabled={!arquivo || loading}
          className="rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright disabled:opacity-60"
        >
          {loading ? 'Enviando...' : 'Enviar documento'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

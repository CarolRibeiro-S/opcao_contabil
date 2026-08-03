'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const badgeBaseClasses =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.04em]'

export default function ConvidarClientePortal({
  clienteId,
  temAcesso,
}: {
  clienteId: string
  temAcesso: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function handleConvidar() {
    setError('')
    setLoading(true)

    const resposta = await fetch('/api/clientes/convidar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: clienteId }),
    })

    const dados = await resposta.json().catch(() => null)

    if (!resposta.ok) {
      setError(dados?.error ?? 'Não foi possível enviar o convite. Tente novamente.')
      setLoading(false)
      return
    }

    setSucesso(true)
    setLoading(false)
    router.refresh()
  }

  if (temAcesso) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className={`${badgeBaseClasses} border border-[#c8e2a1] bg-[#eef7e0] text-[#4f8f2a]`}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#4f8f2a]" />
          Portal: acesso ativo
        </span>

        <button
          type="button"
          onClick={handleConvidar}
          disabled={loading || sucesso}
          title="Envia um novo link de definição de senha, útil se o link original expirou"
          className="text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Reenviando...' : sucesso ? 'Convite reenviado!' : 'Reenviar convite'}
        </button>

        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={`${badgeBaseClasses} border border-rule bg-paper-dim text-navy-soft`}>
        <span className="h-1.5 w-1.5 rounded-full bg-navy-soft/50" />
        Portal: não convidado
      </span>

      <button
        type="button"
        onClick={handleConvidar}
        disabled={loading || sucesso}
        className="text-xs font-semibold text-navy-soft underline decoration-rule underline-offset-2 transition-colors duration-200 hover:text-navy hover:decoration-navy disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Enviando convite...' : sucesso ? 'Convite enviado!' : 'Convidar para o Portal'}
      </button>

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

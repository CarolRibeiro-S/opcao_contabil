'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const badgeBaseClasses =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.04em]'

type ContaExistente = { nome: string | null }

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
  const [contaExistente, setContaExistente] = useState<ContaExistente | null>(null)

  async function handleConvidar(vincularContaExistente = false) {
    setError('')
    setLoading(true)

    const resposta = await fetch('/api/clientes/convidar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: clienteId, ...(vincularContaExistente ? { vincularContaExistente: true } : {}) }),
    })

    const dados = await resposta.json().catch(() => null)

    if (!resposta.ok) {
      setLoading(false)

      // "E-mail já existe" não é um erro terminal — é outra empresa do
      // mesmo dono, provavelmente. Em vez de só mostrar erro, oferece o
      // vínculo (nunca automático: precisa da confirmação explícita
      // abaixo, já que e-mail coincidente entre clientes DIFERENTES
      // também é possível).
      if (dados?.jaExisteConta) {
        setContaExistente({ nome: dados.contaExistente?.nome ?? null })
        return
      }

      setError(dados?.error ?? 'Não foi possível enviar o convite. Tente novamente.')
      return
    }

    setContaExistente(null)
    setSucesso(true)
    setLoading(false)
    router.refresh()
  }

  if (temAcesso) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className={`${badgeBaseClasses} border border-success-border bg-success-bg text-success`}>
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Portal: acesso ativo
        </span>

        <button
          type="button"
          onClick={() => handleConvidar()}
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
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`${badgeBaseClasses} border border-rule bg-paper-dim text-navy-soft`}>
          <span className="h-1.5 w-1.5 rounded-full bg-navy-soft/50" />
          Portal: não convidado
        </span>

        <button
          type="button"
          onClick={() => handleConvidar()}
          disabled={loading || sucesso}
          className="text-xs font-semibold text-navy-soft underline decoration-rule underline-offset-2 transition-colors duration-200 hover:text-navy hover:decoration-navy disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Enviando convite...' : sucesso ? 'Convite enviado!' : 'Convidar para o Portal'}
        </button>

        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      {contaExistente && (
        <div className="flex max-w-md flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <p>
            Esse e-mail já pertence a uma conta{contaExistente.nome ? ` (${contaExistente.nome})` : ''} — provavelmente
            outra empresa do mesmo dono. Vincular esta empresa à mesma conta? O cliente passa a acessar as duas com o
            mesmo login, sem precisar de um código novo.
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleConvidar(true)}
              disabled={loading}
              className="font-semibold underline decoration-dotted underline-offset-2 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Vinculando...' : 'Sim, vincular'}
            </button>
            <button
              type="button"
              onClick={() => setContaExistente(null)}
              disabled={loading}
              className="underline decoration-dotted underline-offset-2 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

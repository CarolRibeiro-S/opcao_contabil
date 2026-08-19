'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Reenvio manual — cobre tanto "o envio automático falhou, tenta de novo"
// (ver EditarCobrancaForm.tsx) quanto "o cliente disse que não recebeu".
// Sempre disponível quando há boleto anexado, mesmo que enviado_email_em já
// esteja preenchido; api/cobrancas/notificar-boleto não tem trava de
// "primeira vez" — essa regra é só do fluxo automático.
export default function ReenviarEmailCobranca({ id }: { id: string }) {
  const router = useRouter()
  const [carregando, setCarregando] = useState(false)

  async function reenviar() {
    if (!window.confirm('Reenviar o e-mail com o boleto pro cliente?')) return

    setCarregando(true)

    try {
      const resposta = await fetch('/api/cobrancas/notificar-boleto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cobrancaId: id }),
      })

      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null)
        window.alert(dados?.error ?? 'Não foi possível enviar o e-mail. Tente novamente.')
        setCarregando(false)
        return
      }
    } catch {
      window.alert('Não foi possível enviar o e-mail. Tente novamente.')
      setCarregando(false)
      return
    }

    setCarregando(false)
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={reenviar}
      disabled={carregando}
      className="text-xs font-semibold text-navy-soft transition-colors duration-200 hover:text-navy disabled:opacity-50"
    >
      {carregando ? '...' : 'Reenviar e-mail'}
    </button>
  )
}

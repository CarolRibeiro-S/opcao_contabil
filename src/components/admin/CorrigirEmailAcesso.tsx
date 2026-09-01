'use client'

import { useState } from 'react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ContaExistente = { nome: string | null }

const inputClasses =
  'w-full rounded-[3px] border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-charcoal outline-none transition-colors duration-200 focus:border-amber-500'

// Corrige o e-mail de ACESSO ao portal (auth.users, via profile_id) — não
// confundir com o campo "E-mail" do formulário acima (clientes.email, só
// contato). Só aparece quando os dois já divergem (ver emailContaVinculada
// em EditarClienteForm.tsx).
export default function CorrigirEmailAcesso({
  clienteId,
  emailAcessoAtual,
  onSucesso,
}: {
  clienteId: string
  emailAcessoAtual: string
  onSucesso: () => void
}) {
  const [novoEmail, setNovoEmail] = useState(emailAcessoAtual)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sucessoMsg, setSucessoMsg] = useState('')
  const [contaExistente, setContaExistente] = useState<ContaExistente | null>(null)

  async function handleAtualizar(confirmarVinculo = false) {
    const emailLimpo = novoEmail.trim().toLowerCase()

    setError('')
    setSucessoMsg('')

    if (!confirmarVinculo) {
      if (!emailLimpo) {
        setError('Informe o novo e-mail de acesso.')
        return
      }
      if (!EMAIL_REGEX.test(emailLimpo)) {
        setError('E-mail inválido.')
        return
      }
    }

    setLoading(true)

    const resposta = await fetch('/api/clientes/atualizar-email-acesso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: clienteId,
        novo_email: emailLimpo,
        ...(confirmarVinculo ? { confirmarVinculo: true } : {}),
      }),
    })

    const dados = await resposta.json().catch(() => null)

    if (!resposta.ok) {
      setLoading(false)

      // Mesmo padrão de "conta já existe" já usado em ConvidarClientePortal:
      // em vez de só rejeitar, oferece vincular esta empresa à conta que já
      // usa esse e-mail.
      if (dados?.jaExisteConta) {
        setContaExistente({ nome: dados.contaExistente?.nome ?? null })
        return
      }

      setError(dados?.error ?? 'Não foi possível atualizar o e-mail de acesso. Tente novamente.')
      return
    }

    setContaExistente(null)
    setLoading(false)

    if (dados?.vinculado) {
      setSucessoMsg(`E-mail de acesso atualizado — vinculado à conta que já usava ${emailLimpo}.`)
    } else if (dados?.reenviado) {
      setSucessoMsg(`E-mail de acesso atualizado e novo código enviado para ${emailLimpo}.`)
    } else {
      setSucessoMsg(`E-mail de acesso atualizado para ${emailLimpo}, mas o reenvio do código falhou. Use "Reenviar convite".`)
    }

    onSucesso()
  }

  if (sucessoMsg) {
    return <p className="mt-1.5 text-xs font-medium text-success">{sucessoMsg}</p>
  }

  return (
    <div className="mt-1.5 flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
      <p>
        O e-mail de contato é diferente do e-mail de acesso ao portal:{' '}
        <span className="font-semibold">{emailAcessoAtual}</span>. Reenviar convite usa o e-mail de acesso — esse
        campo aqui é só o contato exibido no cadastro.
      </p>

      {contaExistente ? (
        <div className="flex flex-col gap-2">
          <p>
            Esse e-mail já pertence a outra conta{contaExistente.nome ? ` (${contaExistente.nome})` : ''}. Vincular
            esta empresa a essa conta em vez de renomear o acesso atual?
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleAtualizar(true)}
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
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={novoEmail}
            onChange={(e) => setNovoEmail(e.target.value)}
            className={`${inputClasses} max-w-xs flex-1`}
            aria-label="Novo e-mail de acesso"
          />
          <button
            type="button"
            onClick={() => handleAtualizar()}
            disabled={loading}
            className="whitespace-nowrap rounded-[3px] border border-amber-400 bg-amber-100 px-3 py-1.5 font-semibold text-amber-900 transition-colors duration-200 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Atualizar e-mail de acesso e reenviar convite'}
          </button>
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}
    </div>
  )
}

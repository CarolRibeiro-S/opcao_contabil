'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { EmailOtpType } from '@supabase/supabase-js'

// Ordem de tentativa quando a URL não informa o tipo (?tipo=invite|recovery)
// — cobre tanto o primeiro convite quanto um reenvio, sem o usuário precisar
// saber a diferença.
const TIPOS_PARA_TENTAR: EmailOtpType[] = ['invite', 'recovery']

export default function VerificarCodigoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [tipoPreferido, setTipoPreferido] = useState<EmailOtpType | null>(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Lido do window.location (não useSearchParams) de propósito — mesma
    // técnica já usada em /login: mantém a página estática no build, sem
    // precisar de Suspense boundary só pra pré-preencher o e-mail.
    const params = new URLSearchParams(window.location.search)
    const emailDaUrl = params.get('email')
    const tipoDaUrl = params.get('tipo')

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (emailDaUrl) setEmail(emailDaUrl)
    if (tipoDaUrl === 'invite' || tipoDaUrl === 'recovery') setTipoPreferido(tipoDaUrl)
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const emailLimpo = email.trim()
    const codigoLimpo = codigo.trim()

    if (!emailLimpo) {
      setError('Informe seu e-mail.')
      return
    }

    if (!/^\d{6,10}$/.test(codigoLimpo)) {
      setError('Código inválido — confira o e-mail que você recebeu.')
      return
    }

    setLoading(true)

    // Se a URL já veio com o tipo certo (é o caso normal, vindo do link do
    // e-mail), tenta só ele. Sem essa informação, tenta os dois tipos
    // possíveis em sequência antes de desistir.
    const tipos = tipoPreferido ? [tipoPreferido] : TIPOS_PARA_TENTAR

    let verificado = false

    for (const tipo of tipos) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: emailLimpo,
        token: codigoLimpo,
        type: tipo,
      })

      if (!verifyError) {
        verificado = true
        break
      }
    }

    setLoading(false)

    if (!verificado) {
      setError(
        'Código inválido ou expirado. Confira o e-mail e o código digitado, ou peça pro administrador reenviar o convite.'
      )
      return
    }

    router.push('/definir-senha')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-2xl border border-rule bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-navy">Digite seu código de acesso</h1>
        <p className="mb-6 text-center text-sm text-navy-soft">
          Confira o e-mail que você recebeu da Opção Contábil e digite o código de acesso abaixo.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-navy-soft">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-rule px-3 py-2 text-navy outline-none focus:border-lime focus:ring-2 focus:ring-lime"
            />
          </div>

          <div>
            <label htmlFor="codigo" className="mb-1 block text-sm font-medium text-navy-soft">
              Código de acesso
            </label>
            <input
              id="codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="00000000"
              className="w-full rounded-lg border border-rule px-3 py-2 text-center font-mono text-2xl tracking-[0.4em] text-navy outline-none focus:border-lime focus:ring-2 focus:ring-lime"
            />
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-lime py-2 font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {loading ? 'Verificando...' : 'Verificar código'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-navy-soft">
          Não recebeu o código ou ele expirou? Peça ao administrador pra reenviar o convite.
        </p>

        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-navy-soft underline underline-offset-2 hover:text-navy"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}

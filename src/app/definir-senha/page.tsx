'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CampoSenha from '@/components/shared/CampoSenha'

function IconEstrela({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 2.5l1.8 4.6 4.7.4-3.6 3.1 1.1 4.6L10 12.8l-4 2.4 1.1-4.6-3.6-3.1 4.7-.4z" />
    </svg>
  )
}

export default function DefinirSenhaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [verificandoSessao, setVerificandoSessao] = useState(true)
  const [sessaoValida, setSessaoValida] = useState(false)

  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function verificarSessao() {
      const { data } = await supabase.auth.getSession()
      setSessaoValida(!!data.session)
      setVerificandoSessao(false)
    }

    verificarSessao()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (senha.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password: senha })

    if (updateError) {
      setError('Não foi possível definir a senha. Tente novamente.')
      setLoading(false)
      return
    }

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      setError('Não foi possível confirmar sua sessão. Faça login novamente.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (profile?.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/portal')
    }

    router.refresh()
  }

  if (verificandoSessao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-4">
        <p className="text-sm text-[#223468]">Verificando link...</p>
      </div>
    )
  }

  if (!sessaoValida) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[#d8ddd0] bg-white p-8 text-center shadow-sm">
          <h1 className="mb-3 text-2xl font-bold text-[#16234a]">Link inválido ou expirado</h1>
          <p className="mb-6 text-sm text-[#223468]">
            Esse link de convite ou redefinição de senha não é mais válido. Peça um novo convite ao
            administrador, ou solicite a redefinição de senha novamente.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-lg bg-[#8dc63f] px-5 py-2 font-semibold text-white transition hover:brightness-95"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#d8ddd0] bg-white p-8 shadow-sm">
        <div className="mb-4 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c8e2a1] bg-[#eef7e0] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#4f8f2a]">
            <IconEstrela className="h-3.5 w-3.5" />
            Convite de Equipe
          </span>
        </div>

        <h1 className="mb-2 text-center text-2xl font-bold text-[#16234a]">Crie seu acesso</h1>
        <p className="mb-6 text-center text-sm text-[#223468]">
          Defina sua senha para acessar o Painel Administrativo da Opção Contábil
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="senha" className="mb-1 block text-sm font-medium text-[#223468]">
              Nova senha
            </label>
            <CampoSenha
              id="senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-[#d8ddd0] px-3 py-2 text-[#16234a] outline-none focus:border-[#8dc63f] focus:ring-2 focus:ring-[#8dc63f]"
            />
          </div>

          <div>
            <label htmlFor="confirmarSenha" className="mb-1 block text-sm font-medium text-[#223468]">
              Confirmar senha
            </label>
            <CampoSenha
              id="confirmarSenha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-[#d8ddd0] px-3 py-2 text-[#16234a] outline-none focus:border-[#8dc63f] focus:ring-2 focus:ring-[#8dc63f]"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#8dc63f] py-2 font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {loading ? 'Salvando...' : 'Definir senha e entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MODULOS_ADMIN } from '@/lib/constants/modulosAdmin'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

export default function ConvidarMembroPage() {
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cargo, setCargo] = useState('')
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState<string[]>(
    MODULOS_ADMIN.map((modulo) => modulo.chave)
  )

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function alternarModulo(chave: string) {
    setPermissoesSelecionadas((atual) =>
      atual.includes(chave) ? atual.filter((modulo) => modulo !== chave) : [...atual, chave]
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const permissoes =
      permissoesSelecionadas.length === MODULOS_ADMIN.length ? null : permissoesSelecionadas

    const resposta = await fetch('/api/equipe/convidar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, telefone: telefone || null, cargo: cargo || null, permissoes }),
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      setError(dados.error ?? 'Não foi possível enviar o convite. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/admin/equipe')
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/equipe"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-navy"
      >
        ← Voltar
      </Link>

      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">Convidar membro</h1>
      <p className="mb-8 text-sm text-navy-soft">
        A pessoa recebe um e-mail para definir a própria senha e acessar o painel administrativo.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="nome" className={labelClasses}>
            Nome
          </label>
          <input
            id="nome"
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClasses}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="telefone" className={labelClasses}>
              Telefone
            </label>
            <input
              id="telefone"
              type="text"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="cargo" className={labelClasses}>
              Cargo
            </label>
            <input
              id="cargo"
              type="text"
              placeholder="Ex: Assistente Contábil"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              className={inputClasses}
            />
          </div>
        </div>

        <div>
          <label className={labelClasses}>Acesso ao painel</label>
          <p className="mb-3 text-xs text-navy-soft">
            Por padrão o convite libera acesso total. Desmarque o que essa pessoa não deve acessar.
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {MODULOS_ADMIN.map((modulo) => (
              <label key={modulo.chave} className="flex items-center gap-2.5 text-sm text-charcoal">
                <input
                  type="checkbox"
                  checked={permissoesSelecionadas.includes(modulo.chave)}
                  onChange={() => alternarModulo(modulo.chave)}
                  className="h-4 w-4 accent-lime"
                />
                {modulo.label}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:opacity-60"
        >
          {loading ? 'Enviando convite...' : 'Enviar convite'}
        </button>
      </form>
    </div>
  )
}

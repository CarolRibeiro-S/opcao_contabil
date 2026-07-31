'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MODULOS_ADMIN } from '@/lib/constants/modulosAdmin'
import CampoTelefone from '@/components/shared/CampoTelefone'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

type Membro = {
  id: string
  nome: string | null
  email: string | null
  telefone: string | null
  cargo: string | null
  permissoes: string[] | null
}

export default function EditarEquipeForm({ membro }: { membro: Membro }) {
  const router = useRouter()

  const [nome, setNome] = useState(membro.nome ?? '')
  const [telefone, setTelefone] = useState(membro.telefone ?? '')
  const [cargo, setCargo] = useState(membro.cargo ?? '')
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState<string[]>(
    membro.permissoes ?? MODULOS_ADMIN.map((modulo) => modulo.chave)
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

    const resposta = await fetch('/api/equipe/atualizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: membro.id,
        nome,
        telefone: telefone || null,
        cargo: cargo || null,
        permissoes,
      }),
    })

    const dados = await resposta.json().catch(() => null)

    if (!resposta.ok) {
      setError(dados?.error ?? 'Não foi possível salvar as alterações. Tente novamente.')
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

      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Editar Membro</h1>

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
            value={membro.email ?? ''}
            disabled
            className={`${inputClasses} cursor-not-allowed opacity-60`}
          />
          <p className="mt-1 text-xs text-navy-soft">O e-mail de login não pode ser alterado por aqui.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="telefone" className={labelClasses}>
              Telefone
            </label>
            <CampoTelefone id="telefone" valor={telefone} onChange={setTelefone} className={inputClasses} />
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
          <div className="mt-1 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
          {loading ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  )
}

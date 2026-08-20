'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ClienteOption = { id: string; nome_empresa: string }

// Só renderizado pela Sidebar/AdminMobileNav quando há 2+ empresas
// vinculadas ao login (decisão de UX — quem tem 1 empresa só não vê nada
// diferente de antes). Troca o cookie via api/portal/trocar-empresa e dá
// refresh — sem precisar logar de novo, já que é o mesmo profile_id.
export default function SeletorEmpresa({
  clientes,
  clienteAtivoId,
}: {
  clientes: ClienteOption[]
  clienteAtivoId: string
}) {
  const router = useRouter()
  const [carregando, setCarregando] = useState(false)

  async function trocar(novoId: string) {
    if (novoId === clienteAtivoId || carregando) return

    setCarregando(true)

    const resposta = await fetch('/api/portal/trocar-empresa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: novoId }),
    })

    setCarregando(false)

    if (!resposta.ok) {
      window.alert('Não foi possível trocar de empresa. Tente novamente.')
      return
    }

    router.refresh()
  }

  return (
    <div className="w-full pt-3">
      <label htmlFor="seletor-empresa" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-navy-soft">
        Empresa
      </label>
      <select
        id="seletor-empresa"
        value={clienteAtivoId}
        onChange={(event) => trocar(event.target.value)}
        disabled={carregando}
        className="w-full rounded-md border border-rule bg-white px-2.5 py-2 text-sm text-charcoal outline-none transition-colors duration-200 focus:border-lime disabled:opacity-60"
      >
        {clientes.map((cliente) => (
          <option key={cliente.id} value={cliente.id}>
            {cliente.nome_empresa}
          </option>
        ))}
      </select>
    </div>
  )
}

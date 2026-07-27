'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ClienteOption = { id: string; nome_empresa: string }

const selectClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime disabled:opacity-60'

export default function SelectCliente({
  value,
  onChange,
  id = 'cliente',
  required = false,
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  required?: boolean
}) {
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function carregarClientes() {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome_empresa')
        .eq('status', 'ativo')
        .order('nome_empresa', { ascending: true })

      setClientes(data ?? [])
      setLoading(false)
    }

    carregarClientes()
  }, [])

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={loading}
      className={selectClasses}
    >
      <option value="" disabled>
        {loading ? 'Carregando clientes...' : 'Selecione um cliente'}
      </option>
      {clientes.map((cliente) => (
        <option key={cliente.id} value={cliente.id}>
          {cliente.nome_empresa}
        </option>
      ))}
    </select>
  )
}

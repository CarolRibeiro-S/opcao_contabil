'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

type Comunicado = {
  id: string
  titulo: string
  tipo: string
  status: string
  created_at: string
}

const tipoLabel: Record<string, string> = {
  aviso: 'Aviso',
  solicitacao_documento: 'Solicitação de Documento',
}

const tipoBadge: Record<string, string> = {
  aviso: 'bg-blue-50 text-blue-700 border border-blue-200',
  solicitacao_documento: 'bg-lime/15 text-[#4f8f2a] border border-lime/40',
}

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  respondido: 'Respondido',
  concluido: 'Concluído',
}

const statusBadge: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700 border border-amber-200',
  respondido: 'bg-blue-50 text-blue-700 border border-blue-200',
  concluido: 'bg-[#eef7e0] text-[#4f8f2a] border border-[#c8e2a1]',
}

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-white px-2 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

function formatarData(data: string) {
  return new Date(data).toLocaleDateString('pt-BR')
}

export default function ComunicadosCliente({ clienteId }: { clienteId: string }) {
  const supabase = createClient()

  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [carregando, setCarregando] = useState(true)

  const [tipo, setTipo] = useState<'aviso' | 'solicitacao_documento'>('aviso')
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')

  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function carregarComunicados() {
    const { data } = await supabase
      .from('comunicados')
      .select('id, titulo, tipo, status, created_at')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })

    setComunicados(data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregarComunicados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setEnviando(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error: insertError } = await supabase.from('comunicados').insert({
      cliente_id: clienteId,
      tipo,
      titulo,
      mensagem,
      status: 'pendente',
      enviado_por: user?.id ?? null,
    })

    if (insertError) {
      setError('Não foi possível enviar o comunicado. Tente novamente.')
      setEnviando(false)
      return
    }

    setTitulo('')
    setMensagem('')
    setTipo('aviso')
    setEnviando(false)
    await carregarComunicados()
  }

  return (
    <div className="mt-10 border-t border-rule pt-8">
      <h2 className="mb-4 font-display text-lg font-semibold text-navy">Comunicados</h2>

      {carregando ? (
        <p className="mb-6 text-sm text-navy-soft">Carregando...</p>
      ) : comunicados.length === 0 ? (
        <p className="mb-6 text-sm text-navy-soft">Nenhum comunicado enviado ainda.</p>
      ) : (
        <ul className="mb-6 flex flex-col gap-2">
          {comunicados.map((comunicado) => (
            <li
              key={comunicado.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule bg-white px-3 py-2.5 text-sm"
            >
              <span className="font-medium text-navy">{comunicado.titulo}</span>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${
                    tipoBadge[comunicado.tipo] ?? 'border border-rule bg-paper-dim text-navy-soft'
                  }`}
                >
                  {tipoLabel[comunicado.tipo] ?? comunicado.tipo}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${
                    statusBadge[comunicado.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                  }`}
                >
                  {statusLabel[comunicado.status] ?? comunicado.status}
                </span>
                <span className="font-mono text-[11px] text-navy-soft">
                  {formatarData(comunicado.created_at)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-rule bg-paper-dim p-4">
        <div>
          <label htmlFor="comunicadoTipo" className={labelClasses}>
            Tipo
          </label>
          <select
            id="comunicadoTipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as 'aviso' | 'solicitacao_documento')}
            className={inputClasses}
          >
            <option value="aviso">Aviso</option>
            <option value="solicitacao_documento">Solicitação de Documento</option>
          </select>
        </div>

        <div>
          <label htmlFor="comunicadoTitulo" className={labelClasses}>
            Título
          </label>
          <input
            id="comunicadoTitulo"
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="comunicadoMensagem" className={labelClasses}>
            Mensagem
          </label>
          <textarea
            id="comunicadoMensagem"
            required
            rows={3}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright disabled:opacity-60"
        >
          {enviando ? 'Enviando...' : 'Enviar comunicado'}
        </button>
      </form>
    </div>
  )
}

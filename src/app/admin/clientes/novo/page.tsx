'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SEGMENTOS } from '@/lib/constants/segmentos'
import ProfissionaisEditor from '@/components/admin/ProfissionaisEditor'
import AnexosInput from '@/components/admin/AnexosInput'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

export default function NovoClientePage() {
  const router = useRouter()
  const supabase = createClient()

  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [tipo, setTipo] = useState<'pessoa_juridica' | 'mei'>('pessoa_juridica')
  const [segmento, setSegmento] = useState<string>(SEGMENTOS[0])
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [isClinica, setIsClinica] = useState(false)
  const [profissionais, setProfissionais] = useState<string[]>([])

  const [anexos, setAnexos] = useState<File[]>([])

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { data: cliente, error: insertError } = await supabase
      .from('clientes')
      .insert({
        nome_empresa: nomeEmpresa,
        cnpj_cpf: cnpjCpf || null,
        tipo,
        segmento,
        email: email || null,
        telefone: telefone || null,
        observacoes: observacoes || null,
        status: 'ativo',
      })
      .select('id')
      .single()

    if (insertError || !cliente) {
      setError('Não foi possível salvar o cliente. Tente novamente.')
      setLoading(false)
      return
    }

    if (isClinica && profissionais.length > 0) {
      const { error: profissionaisError } = await supabase
        .from('profissionais_clinica')
        .insert(profissionais.map((nome) => ({ nome, cliente_id: cliente.id })))

      if (profissionaisError) {
        setError('Cliente salvo, mas houve um erro ao salvar os profissionais.')
        setLoading(false)
        return
      }
    }

    for (const arquivo of anexos) {
      const caminhoArquivo = `${cliente.id}/${arquivo.name}`

      const { error: uploadError } = await supabase.storage
        .from('documentos-clientes')
        .upload(caminhoArquivo, arquivo)

      if (uploadError) {
        setError(`Cliente salvo, mas houve um erro ao anexar "${arquivo.name}".`)
        setLoading(false)
        return
      }

      const extensao = arquivo.name.split('.').pop() ?? ''

      const { error: documentoError } = await supabase.from('documentos_clientes').insert({
        cliente_id: cliente.id,
        nome_arquivo: arquivo.name,
        tipo: extensao,
        caminho_arquivo: caminhoArquivo,
      })

      if (documentoError) {
        setError(`Cliente salvo, mas houve um erro ao registrar "${arquivo.name}".`)
        setLoading(false)
        return
      }
    }

    router.push('/admin/clientes')
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/clientes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-navy"
      >
        ← Voltar
      </Link>

      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Novo Cliente</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="nomeEmpresa" className={labelClasses}>
            Nome da empresa
          </label>
          <input
            id="nomeEmpresa"
            type="text"
            required
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label htmlFor="cnpjCpf" className={labelClasses}>
              CNPJ/CPF
            </label>
            <input
              id="cnpjCpf"
              type="text"
              value={cnpjCpf}
              onChange={(e) => setCnpjCpf(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="tipo" className={labelClasses}>
              Tipo
            </label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as 'pessoa_juridica' | 'mei')}
              className={inputClasses}
            >
              <option value="pessoa_juridica">Pessoa Jurídica</option>
              <option value="mei">MEI</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="segmento" className={labelClasses}>
            Segmento
          </label>
          <select
            id="segmento"
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            className={inputClasses}
          >
            {SEGMENTOS.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label htmlFor="email" className={labelClasses}>
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClasses}
            />
          </div>

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
        </div>

        <div>
          <label htmlFor="observacoes" className={labelClasses}>
            Observações
          </label>
          <textarea
            id="observacoes"
            rows={4}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </div>

        <label className="flex items-center gap-2.5 pt-2 text-sm text-navy-soft">
          <input
            type="checkbox"
            checked={isClinica}
            onChange={(e) => setIsClinica(e.target.checked)}
            className="h-4 w-4 accent-lime"
          />
          É uma clínica com múltiplos profissionais?
        </label>

        {isClinica && <ProfissionaisEditor profissionais={profissionais} onChange={setProfissionais} />}

        <div>
          <label className={labelClasses}>Anexos</label>
          <AnexosInput files={anexos} onChange={setAnexos} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:opacity-60"
        >
          {loading ? 'Salvando...' : 'Salvar cliente'}
        </button>
      </form>
    </div>
  )
}

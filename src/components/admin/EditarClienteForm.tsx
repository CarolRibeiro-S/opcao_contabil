'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SEGMENTOS } from '@/lib/constants/segmentos'
import ProfissionaisEditor from '@/components/admin/ProfissionaisEditor'
import AnexosInput from '@/components/admin/AnexosInput'
import ComunicadosCliente from '@/components/admin/ComunicadosCliente'
import { registrarHistoricoCliente } from '@/lib/historicoCliente'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

type Cliente = {
  id: string
  nome_empresa: string
  apelido: string | null
  cnpj_cpf: string | null
  tipo: string
  regime_tributario: string | null
  segmento: string | null
  responsavel: string | null
  email: string | null
  telefone: string | null
  observacoes: string | null
  status: string
}

type Documento = {
  id: string
  nome_arquivo: string
  tipo: string | null
  caminho_arquivo: string
  signedUrl: string | null
}

export default function EditarClienteForm({
  cliente,
  profissionaisIniciais,
  documentosIniciais,
}: {
  cliente: Cliente
  profissionaisIniciais: string[]
  documentosIniciais: Documento[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [nomeEmpresa, setNomeEmpresa] = useState(cliente.nome_empresa)
  const [apelido, setApelido] = useState(cliente.apelido ?? '')
  const [cnpjCpf, setCnpjCpf] = useState(cliente.cnpj_cpf ?? '')
  const [tipo, setTipo] = useState<'pessoa_juridica' | 'mei'>(
    cliente.tipo === 'mei' ? 'mei' : 'pessoa_juridica'
  )
  const [regimeTributario, setRegimeTributario] = useState(cliente.regime_tributario ?? '')
  const [segmento, setSegmento] = useState(cliente.segmento ?? SEGMENTOS[0])
  const [responsavel, setResponsavel] = useState(cliente.responsavel ?? '')
  const [email, setEmail] = useState(cliente.email ?? '')
  const [telefone, setTelefone] = useState(cliente.telefone ?? '')
  const [observacoes, setObservacoes] = useState(cliente.observacoes ?? '')
  const [status, setStatus] = useState(cliente.status)

  const [isClinica, setIsClinica] = useState(profissionaisIniciais.length > 0)
  const [profissionais, setProfissionais] = useState<string[]>(profissionaisIniciais)

  const [anexos, setAnexos] = useState<File[]>([])

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error: updateError } = await supabase
      .from('clientes')
      .update({
        nome_empresa: nomeEmpresa,
        apelido: apelido || null,
        cnpj_cpf: cnpjCpf || null,
        tipo,
        regime_tributario: tipo === 'mei' ? null : regimeTributario || null,
        segmento,
        responsavel: responsavel || null,
        email: email || null,
        telefone: telefone || null,
        observacoes: observacoes || null,
        status,
      })
      .eq('id', cliente.id)

    if (updateError) {
      setError('Não foi possível salvar as alterações. Tente novamente.')
      setLoading(false)
      return
    }

    registrarHistoricoCliente({
      acao: 'editou',
      entidade: 'cliente',
      entidadeId: cliente.id,
      entidadeNome: nomeEmpresa,
    })

    const { error: deleteError } = await supabase
      .from('profissionais_clinica')
      .delete()
      .eq('cliente_id', cliente.id)

    if (deleteError) {
      setError('Cliente salvo, mas houve um erro ao atualizar os profissionais.')
      setLoading(false)
      return
    }

    if (isClinica && profissionais.length > 0) {
      const { error: profissionaisError } = await supabase
        .from('profissionais_clinica')
        .insert(profissionais.map((nome) => ({ nome, cliente_id: cliente.id })))

      if (profissionaisError) {
        setError('Cliente salvo, mas houve um erro ao atualizar os profissionais.')
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

      <h1 className="mb-8 font-display text-2xl font-semibold text-navy">Editar Cliente</h1>

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

        <div>
          <label htmlFor="apelido" className={labelClasses}>
            Apelido
          </label>
          <input
            id="apelido"
            type="text"
            placeholder="Nome curto usado nos arquivos, ex: WNF, GREENTEC"
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
              <option value="pessoa_juridica">PJ</option>
              <option value="mei">MEI</option>
            </select>
          </div>
        </div>

        {tipo === 'pessoa_juridica' && (
          <div>
            <label htmlFor="regimeTributario" className={labelClasses}>
              Regime Tributário
            </label>
            <select
              id="regimeTributario"
              value={regimeTributario}
              onChange={(e) => setRegimeTributario(e.target.value)}
              className={inputClasses}
            >
              <option value="">Selecione</option>
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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

          <div>
            <label htmlFor="status" className={labelClasses}>
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClasses}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="responsavel" className={labelClasses}>
            Responsável pela empresa
          </label>
          <input
            id="responsavel"
            type="text"
            placeholder="Nome de quem responde pela empresa"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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

        {profissionaisIniciais.length > 0 && (
          <div className="rounded-lg border border-rule bg-paper-dim p-4">
            <p className="mb-2 text-sm text-navy-soft">
              Este cliente tem profissionais cadastrados. Você pode importar a apuração mensal por
              médico a partir da planilha do escritório.
            </p>
            <Link
              href={`/admin/clientes/${cliente.id}/importar-planilha`}
              className="inline-flex items-center gap-2 rounded-[3px] border-[1.3px] border-navy px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper"
            >
              📊 Importar planilha de apuração
            </Link>
          </div>
        )}

        <div>
          <label className={labelClasses}>Documentos anexados</label>

          {documentosIniciais.length === 0 ? (
            <p className="text-sm text-navy-soft">Nenhum documento anexado ainda.</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-1.5">
              {documentosIniciais.map((documento) => (
                <li
                  key={documento.id}
                  className="flex items-center justify-between rounded-md border border-rule bg-white px-3 py-2 text-sm text-charcoal"
                >
                  {documento.nome_arquivo}
                  {documento.signedUrl ? (
                    <a
                      href={documento.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-navy-soft transition-colors duration-200 hover:text-navy"
                    >
                      Baixar
                    </a>
                  ) : (
                    <span className="text-xs text-navy-soft/60">indisponível</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className={labelClasses}>Anexar novos documentos</p>
          <AnexosInput files={anexos} onChange={setAnexos} />
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

      <ComunicadosCliente clienteId={cliente.id} />
    </div>
  )
}

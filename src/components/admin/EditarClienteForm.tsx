'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SEGMENTOS } from '@/lib/constants/segmentos'
import ProfissionaisEditor from '@/components/admin/ProfissionaisEditor'
import AnexosInput from '@/components/admin/AnexosInput'
import ComunicadosCliente from '@/components/admin/ComunicadosCliente'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'
import CampoDocumento from '@/components/shared/CampoDocumento'
import CampoTelefone from '@/components/shared/CampoTelefone'
import CampoMoeda from '@/components/shared/CampoMoeda'
import ConvidarClientePortal from '@/components/admin/ConvidarClientePortal'
import { sanitizarNomeArquivo } from '@/lib/storage/sanitizarNomeArquivo'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

type Cliente = {
  id: string
  nome_empresa: string
  codigo_interno: number | null
  apelido: string | null
  cnpj_cpf: string | null
  tipo: string
  regime_tributario: string | null
  possui_empregados: boolean | null
  obrigado_efd_contribuicoes: boolean | null
  emite_notas_fiscais: boolean | null
  segmento: string | null
  responsavel: string | null
  email: string | null
  telefone: string | null
  honorario_valor_mensal: number | null
  honorario_dia_vencimento: number | null
  observacoes: string | null
  status: string
  profile_id: string | null
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
  const [codigoInterno, setCodigoInterno] = useState(
    cliente.codigo_interno !== null ? String(cliente.codigo_interno) : ''
  )
  const [apelido, setApelido] = useState(cliente.apelido ?? '')
  const [cnpjCpf, setCnpjCpf] = useState(cliente.cnpj_cpf ?? '')
  const [tipo, setTipo] = useState<'pessoa_juridica' | 'mei'>(
    cliente.tipo === 'mei' ? 'mei' : 'pessoa_juridica'
  )
  const [regimeTributario, setRegimeTributario] = useState(cliente.regime_tributario ?? '')
  const [possuiEmpregados, setPossuiEmpregados] = useState(!!cliente.possui_empregados)
  const [obrigadoEfdContribuicoes, setObrigadoEfdContribuicoes] = useState(!!cliente.obrigado_efd_contribuicoes)
  const [emiteNotasFiscais, setEmiteNotasFiscais] = useState(cliente.emite_notas_fiscais ?? true)
  const [segmento, setSegmento] = useState(cliente.segmento ?? SEGMENTOS[0])
  const [responsavel, setResponsavel] = useState(cliente.responsavel ?? '')
  const [email, setEmail] = useState(cliente.email ?? '')
  const [telefone, setTelefone] = useState(cliente.telefone ?? '')
  const [honorarioValorMensal, setHonorarioValorMensal] = useState<number | null>(cliente.honorario_valor_mensal)
  const [honorarioDiaVencimento, setHonorarioDiaVencimento] = useState(
    cliente.honorario_dia_vencimento !== null ? String(cliente.honorario_dia_vencimento) : ''
  )
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
        codigo_interno: codigoInterno ? Number(codigoInterno) : null,
        apelido: apelido || null,
        cnpj_cpf: cnpjCpf || null,
        tipo,
        regime_tributario: tipo === 'mei' ? null : regimeTributario || null,
        possui_empregados: tipo === 'mei' ? false : possuiEmpregados,
        obrigado_efd_contribuicoes: tipo === 'mei' ? false : obrigadoEfdContribuicoes,
        emite_notas_fiscais: emiteNotasFiscais,
        segmento,
        responsavel: responsavel || null,
        email: email || null,
        telefone: telefone || null,
        honorario_valor_mensal: honorarioValorMensal,
        honorario_dia_vencimento: honorarioDiaVencimento ? Number(honorarioDiaVencimento) : null,
        observacoes: observacoes || null,
        status,
      })
      .eq('id', cliente.id)

    if (updateError) {
      setError('Não foi possível salvar as alterações. Tente novamente.')
      setLoading(false)
      return
    }

    registrarHistoricoAtividade({
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

    for (const [index, arquivo] of anexos.entries()) {
      // Timestamp (+ índice, já que o input aceita vários arquivos de uma
      // vez — dois podem ter o mesmo nome e cair no mesmo milissegundo)
      // evita "resource already exists" quando o mesmo nome de arquivo é
      // enviado mais de uma vez pro mesmo cliente, ex: reenviar uma versão
      // atualizada de um documento — mesmo padrão já usado no
      // ThreadComunicado e nos outros pontos de upload de documentos.
      const caminhoArquivo = `${cliente.id}/${Date.now()}-${index}-${sanitizarNomeArquivo(arquivo.name)}`

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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Editar Cliente</h1>
        <ConvidarClientePortal clienteId={cliente.id} temAcesso={!!cliente.profile_id} />
      </div>

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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[140px_1fr]">
          <div>
            <label htmlFor="codigoInterno" className={labelClasses}>
              Código
            </label>
            <input
              id="codigoInterno"
              type="number"
              placeholder="Ex: 102"
              value={codigoInterno}
              onChange={(e) => setCodigoInterno(e.target.value)}
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
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="cnpjCpf" className={labelClasses}>
              CNPJ/CPF
            </label>
            <CampoDocumento id="cnpjCpf" valor={cnpjCpf} onChange={setCnpjCpf} className={inputClasses} />
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
              <option value="sociedade_sem_fins_lucrativos">Sociedade sem fins lucrativos</option>
            </select>
          </div>
        )}

        {tipo === 'pessoa_juridica' && (
          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-2.5 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={possuiEmpregados}
                onChange={(e) => setPossuiEmpregados(e.target.checked)}
                className="h-4 w-4 accent-lime"
              />
              Possui empregados?
            </label>
            <label className="flex items-center gap-2.5 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={obrigadoEfdContribuicoes}
                onChange={(e) => setObrigadoEfdContribuicoes(e.target.checked)}
                className="h-4 w-4 accent-lime"
              />
              Obrigado à EFD-Contribuições?
            </label>
          </div>
        )}

        <label className="flex items-center gap-2.5 text-sm text-charcoal">
          <input
            type="checkbox"
            checked={emiteNotasFiscais}
            onChange={(e) => setEmiteNotasFiscais(e.target.checked)}
            className="h-4 w-4 accent-lime"
          />
          Emite notas fiscais? (define se a solicitação mensal de documentos inclui o pedido de XML)
        </label>

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
            <CampoTelefone id="telefone" valor={telefone} onChange={setTelefone} className={inputClasses} />
          </div>
        </div>

        <div className="rounded-lg border border-rule bg-paper-dim p-4">
          <p className={labelClasses}>Honorário mensal (opcional)</p>
          <p className="mb-3 -mt-1 text-xs text-navy-soft">
            Preenchendo os dois campos abaixo, o cliente passa a ter o honorário do mês gerado
            automaticamente todo dia 1 (o boleto continua sendo anexado manualmente depois).
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="honorarioValorMensal" className={labelClasses}>
                Valor mensal
              </label>
              <CampoMoeda
                id="honorarioValorMensal"
                valor={honorarioValorMensal}
                onChange={setHonorarioValorMensal}
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="honorarioDiaVencimento" className={labelClasses}>
                Dia de vencimento
              </label>
              <input
                id="honorarioDiaVencimento"
                type="number"
                min={1}
                max={31}
                placeholder="Ex: 10"
                value={honorarioDiaVencimento}
                onChange={(e) => setHonorarioDiaVencimento(e.target.value)}
                className={inputClasses}
              />
            </div>
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

      <ComunicadosCliente clienteId={cliente.id} nomeCliente={cliente.nome_empresa} />
    </div>
  )
}

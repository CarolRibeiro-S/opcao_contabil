'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SEGMENTOS } from '@/lib/constants/segmentos'
import ProfissionaisEditor from '@/components/admin/ProfissionaisEditor'
import AnexosInput from '@/components/admin/AnexosInput'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'
import CampoDocumento from '@/components/shared/CampoDocumento'
import CampoTelefone from '@/components/shared/CampoTelefone'
import CampoMoeda from '@/components/shared/CampoMoeda'
import { sanitizarNomeArquivo } from '@/lib/storage/sanitizarNomeArquivo'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

export default function NovoClientePage() {
  const router = useRouter()
  const supabase = createClient()

  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [codigoInterno, setCodigoInterno] = useState('')
  const [apelido, setApelido] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [tipo, setTipo] = useState<'pessoa_juridica' | 'mei'>('pessoa_juridica')
  const [regimeTributario, setRegimeTributario] = useState('')
  const [possuiEmpregados, setPossuiEmpregados] = useState(false)
  const [obrigadoEfdContribuicoes, setObrigadoEfdContribuicoes] = useState(false)
  const [emiteNotasFiscais, setEmiteNotasFiscais] = useState(true)
  const [segmento, setSegmento] = useState<string>(SEGMENTOS[0])
  const [responsavel, setResponsavel] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [honorarioValorMensal, setHonorarioValorMensal] = useState<number | null>(null)
  const [honorarioDiaVencimento, setHonorarioDiaVencimento] = useState('')
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
        status: 'ativo',
      })
      .select('id')
      .single()

    if (insertError || !cliente) {
      setError('Não foi possível salvar o cliente. Tente novamente.')
      setLoading(false)
      return
    }

    registrarHistoricoAtividade({
      acao: 'criou',
      entidade: 'cliente',
      entidadeId: cliente.id,
      entidadeNome: nomeEmpresa,
    })

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

'use client'

import { useRef, useState, type DragEvent } from 'react'
import {
  detectarClientePorCnpj,
  detectarClientePorNomeArquivo,
  detectarTipo,
  somenteDigitos,
  TIPOS_SEM_VENCIMENTO,
  type ArquivoRevisado,
  type ClienteOption,
  type OrigemDeteccao,
  type ProfissionalOption,
} from '@/lib/envioMensal'

function ehPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export default function EnvioMensalArquivos({
  clientes,
  profissionais,
  tiposDisponiveis,
  arquivosIniciais,
  onVoltar,
  onContinuar,
}: {
  clientes: ClienteOption[]
  profissionais: ProfissionalOption[]
  tiposDisponiveis: string[]
  arquivosIniciais: ArquivoRevisado[]
  onVoltar: () => void
  onContinuar: (arquivos: ArquivoRevisado[]) => void
}) {
  const [arquivos, setArquivos] = useState<ArquivoRevisado[]>(arquivosIniciais)
  const [processando, setProcessando] = useState<Set<string>>(new Set())
  const [arrastando, setArrastando] = useState(false)
  const [erroExtracao, setErroExtracao] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function adicionarArquivos(lista: FileList | null) {
    if (!lista || lista.length === 0) return

    const novos: ArquivoRevisado[] = Array.from(lista).map((file) => {
      const deteccao = detectarClientePorNomeArquivo(file.name, clientes, profissionais)

      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        clienteId: deteccao.clienteId,
        clienteIdDetectado: deteccao.clienteId,
        tipo: detectarTipo(file.name) ?? '',
        dataVencimento: '',
        origemDeteccao: deteccao.origemDeteccao as OrigemDeteccao,
        cnpjCompletoExtraido: null,
        cnpjRaizExtraido: null,
      }
    })

    setArquivos((atual) => [...atual, ...novos])

    const novosPdfs = novos.filter((arquivo) => ehPdf(arquivo.file))
    if (novosPdfs.length === 0) return

    setProcessando((atual) => new Set([...atual, ...novosPdfs.map((arquivo) => arquivo.id)]))
    setErroExtracao('')

    try {
      const formData = new FormData()
      formData.append('ids', JSON.stringify(novosPdfs.map((arquivo) => arquivo.id)))
      for (const arquivo of novosPdfs) {
        formData.append(arquivo.id, arquivo.file)
      }

      const resposta = await fetch('/api/extrair-pdf', { method: 'POST', body: formData })
      const dados = await resposta.json()

      if (!resposta.ok) {
        setErroExtracao('Não foi possível ler os PDFs automaticamente. Preencha os campos manualmente.')
        return
      }

      const resultados: Record<
        string,
        { cnpjCompleto: string | null; cnpjRaiz: string | null; dataVencimento: string | null } | null
      > = dados.resultados ?? {}

      setArquivos((atual) =>
        atual.map((arquivo) => {
          const extraido = resultados[arquivo.id]
          if (extraido === undefined) return arquivo

          if (!extraido) {
            return arquivo.clienteId ? arquivo : { ...arquivo, origemDeteccao: 'manual' as OrigemDeteccao }
          }

          const clienteIdPorCnpj = detectarClientePorCnpj(
            extraido.cnpjCompleto,
            extraido.cnpjRaiz,
            clientes
          )

          const clienteId = clienteIdPorCnpj ?? arquivo.clienteId
          const origemDeteccao: OrigemDeteccao = clienteIdPorCnpj
            ? 'cnpj'
            : arquivo.clienteId
              ? arquivo.origemDeteccao
              : 'manual'

          return {
            ...arquivo,
            clienteId,
            // Só atualiza a "detecção" (a baseline usada pro aviso de
            // divergência) quando o CNPJ realmente bateu com algum cliente —
            // do contrário mantém o que a detecção por nome já tinha achado,
            // que continua sendo a melhor detecção automática disponível.
            clienteIdDetectado: clienteIdPorCnpj ?? arquivo.clienteIdDetectado,
            origemDeteccao,
            dataVencimento: extraido.dataVencimento ?? arquivo.dataVencimento,
            cnpjCompletoExtraido: extraido.cnpjCompleto,
            cnpjRaizExtraido: extraido.cnpjRaiz,
          }
        })
      )
    } catch {
      setErroExtracao('Não foi possível ler os PDFs automaticamente. Preencha os campos manualmente.')
    } finally {
      setProcessando((atual) => {
        const novo = new Set(atual)
        for (const arquivo of novosPdfs) novo.delete(arquivo.id)
        return novo
      })
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setArrastando(false)
    adicionarArquivos(event.dataTransfer.files)
  }

  function removerArquivo(id: string) {
    setArquivos((atual) => atual.filter((arquivo) => arquivo.id !== id))
  }

  function atualizarArquivo(
    id: string,
    campo: 'clienteId' | 'tipo' | 'dataVencimento',
    valor: string
  ) {
    setArquivos((atual) =>
      atual.map((arquivo) =>
        arquivo.id === id
          ? {
              ...arquivo,
              [campo]: valor,
              ...(campo === 'clienteId' ? { origemDeteccao: 'manual' as OrigemDeteccao } : {}),
              ...(campo === 'tipo' && TIPOS_SEM_VENCIMENTO.includes(valor) ? { dataVencimento: '' } : {}),
            }
          : arquivo
      )
    )
  }

  const naoIdentificados = arquivos.filter((arquivo) => !arquivo.clienteId)

  const identificadosPorCliente = new Map<string, ArquivoRevisado[]>()
  for (const arquivo of arquivos) {
    if (!arquivo.clienteId) continue
    const lista = identificadosPorCliente.get(arquivo.clienteId) ?? []
    lista.push(arquivo)
    identificadosPorCliente.set(arquivo.clienteId, lista)
  }

  const aindaProcessando = processando.size > 0
  const todosCompletos =
    arquivos.length > 0 &&
    !aindaProcessando &&
    arquivos.every(
      (arquivo) =>
        arquivo.clienteId &&
        arquivo.tipo &&
        (arquivo.dataVencimento || TIPOS_SEM_VENCIMENTO.includes(arquivo.tipo))
    )

  function nomeCliente(clienteId: string) {
    return clientes.find((cliente) => cliente.id === clienteId)?.nome_empresa ?? 'Cliente'
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={(event) => {
          event.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onClick={() => inputRef.current?.click()}
        className={`mb-6 flex h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors duration-200 ${
          arrastando ? 'border-lime bg-lime/10' : 'border-rule bg-white hover:border-navy'
        }`}
      >
        <p className="font-medium text-navy">Arraste os arquivos aqui ou clique para selecionar</p>
        <p className="mt-1 text-xs text-navy-soft">
          Guias e comprovantes do mês — CNPJ e vencimento são lidos automaticamente de dentro dos PDFs
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={(event) => {
            adicionarArquivos(event.target.files)
            event.target.value = ''
          }}
          className="hidden"
        />
      </div>

      {erroExtracao && <p className="mb-4 text-sm text-red-600">{erroExtracao}</p>}

      {arquivos.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum arquivo adicionado ainda.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(identificadosPorCliente.entries()).map(([clienteId, arquivosDoCliente]) => (
            <div key={clienteId} className="rounded-lg border border-rule bg-white p-4">
              <h3 className="mb-3 font-display text-base font-semibold text-navy">{nomeCliente(clienteId)}</h3>
              <div className="flex flex-col gap-2">
                {arquivosDoCliente.map((arquivo) => (
                  <LinhaArquivo
                    key={arquivo.id}
                    arquivo={arquivo}
                    clientes={clientes}
                    tiposDisponiveis={tiposDisponiveis}
                    processando={processando.has(arquivo.id)}
                    onAtualizar={atualizarArquivo}
                    onRemover={removerArquivo}
                  />
                ))}
              </div>
            </div>
          ))}

          {naoIdentificados.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <h3 className="mb-1 font-display text-base font-semibold text-amber-800">Não identificados</h3>
              <p className="mb-3 text-xs text-amber-700">
                Não encontramos o CNPJ, apelido, nome da empresa nem profissional de nenhum cliente nesses
                arquivos. Selecione manualmente.
              </p>
              <div className="flex flex-col gap-2">
                {naoIdentificados.map((arquivo) => (
                  <LinhaArquivo
                    key={arquivo.id}
                    arquivo={arquivo}
                    clientes={clientes}
                    tiposDisponiveis={tiposDisponiveis}
                    processando={processando.has(arquivo.id)}
                    onAtualizar={atualizarArquivo}
                    onRemover={removerArquivo}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="rounded-[3px] border-[1.3px] border-navy px-5 py-2.5 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper"
        >
          ← Voltar
        </button>
        <button
          type="button"
          onClick={() => onContinuar(arquivos)}
          disabled={!todosCompletos}
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          Revisar e continuar
        </button>
        {aindaProcessando && (
          <span className="text-xs text-navy-soft">Lendo os PDFs...</span>
        )}
        {!aindaProcessando && !todosCompletos && arquivos.length > 0 && (
          <span className="text-xs text-navy-soft">
            Defina cliente, tipo e vencimento de todos os arquivos para continuar.
          </span>
        )}
      </div>
    </div>
  )
}

// Apelido primeiro (ex: "Centro Oeste — GABRIELLA A. O. DE S. MACHADO
// COMERCIO") — o nome legal completo sozinho, numa lista de ~50+ opções em
// ordem alfabética, foi o que tornou fácil selecionar a empresa errada no
// caso Agatha/Centro Oeste (apelido curto e reconhecível bate mais rápido
// visualmente que ler nome jurídico completo).
function rotuloCliente(cliente: ClienteOption) {
  return cliente.apelido ? `${cliente.apelido} — ${cliente.nome_empresa}` : cliente.nome_empresa
}

function nomeParaExibicao(clienteId: string, clientes: ClienteOption[]) {
  const cliente = clientes.find((c) => c.id === clienteId)
  if (!cliente) return 'Cliente'
  return cliente.apelido || cliente.nome_empresa
}

// Segundo sinal de possível arquivo no lugar errado: o CNPJ lido de dentro
// do PDF não bate com o cadastrado pro cliente ATUALMENTE selecionado
// (detectado automaticamente ou escolhido manualmente — os dois casos
// contam, por pedido explícito).
function cnpjDivergente(arquivo: ArquivoRevisado, clientes: ClienteOption[]) {
  if (!arquivo.cnpjCompletoExtraido && !arquivo.cnpjRaizExtraido) return false

  const clienteSelecionado = clientes.find((c) => c.id === arquivo.clienteId)
  if (!clienteSelecionado?.cnpj_cpf) return false

  const cnpjSelecionado = somenteDigitos(clienteSelecionado.cnpj_cpf)

  if (arquivo.cnpjCompletoExtraido) return cnpjSelecionado !== arquivo.cnpjCompletoExtraido
  if (arquivo.cnpjRaizExtraido) return cnpjSelecionado.slice(0, 8) !== arquivo.cnpjRaizExtraido
  return false
}

function IconAlerta({ className }: { className?: string }) {
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
      <path d="M10 3.3L17.5 16.2h-15z" />
      <path d="M10 8.2v3.3M10 14.2h.01" />
    </svg>
  )
}

function Badge({ origem }: { origem: OrigemDeteccao }) {
  if (origem === 'cnpj') {
    return (
      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
        CNPJ
      </span>
    )
  }

  if (origem === 'apelido') {
    return (
      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
        Apelido
      </span>
    )
  }

  if (origem === 'nome') {
    return (
      <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
        Nome
      </span>
    )
  }

  if (origem === 'medico') {
    return (
      <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
        Médico
      </span>
    )
  }

  return (
    <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
      Manual
    </span>
  )
}

function LinhaArquivo({
  arquivo,
  clientes,
  tiposDisponiveis,
  processando,
  onAtualizar,
  onRemover,
}: {
  arquivo: ArquivoRevisado
  clientes: ClienteOption[]
  tiposDisponiveis: string[]
  processando: boolean
  onAtualizar: (id: string, campo: 'clienteId' | 'tipo' | 'dataVencimento', valor: string) => void
  onRemover: (id: string) => void
}) {
  // Só conta como divergência de seleção se JÁ havia uma detecção
  // automática (clienteIdDetectado não vazio) E a seleção atual foi pra um
  // cliente diferente dela — arquivo que nunca teve detecção nenhuma
  // (clienteIdDetectado === '') e foi preenchido manualmente não dispara
  // isso, não tem baseline pra comparar.
  const divergenciaSelecao =
    !!arquivo.clienteIdDetectado && !!arquivo.clienteId && arquivo.clienteIdDetectado !== arquivo.clienteId
  const divergenciaCnpj = cnpjDivergente(arquivo, clientes)
  const temAviso = divergenciaSelecao || divergenciaCnpj

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 ${
          temAviso ? 'border-amber-400 bg-amber-50' : 'border-rule bg-paper-dim'
        }`}
      >
        <Badge origem={arquivo.origemDeteccao} />

        <span className="min-w-0 flex-1 truncate text-sm text-charcoal" title={arquivo.file.name}>
          {arquivo.file.name}
        </span>

        {processando && <span className="shrink-0 text-xs text-navy-soft">lendo...</span>}

        <select
          value={arquivo.clienteId}
          onChange={(event) => onAtualizar(arquivo.id, 'clienteId', event.target.value)}
          className="rounded-[3px] border border-rule bg-white px-2 py-1.5 text-xs text-charcoal outline-none focus:border-lime"
        >
          <option value="">Selecione o cliente</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {rotuloCliente(cliente)}
            </option>
          ))}
        </select>

      <select
        value={arquivo.tipo}
        onChange={(event) => onAtualizar(arquivo.id, 'tipo', event.target.value)}
        className="rounded-[3px] border border-rule bg-white px-2 py-1.5 text-xs text-charcoal outline-none focus:border-lime"
      >
        <option value="">Tipo</option>
        {tiposDisponiveis.map((tipo) => (
          <option key={tipo} value={tipo}>
            {tipo}
          </option>
        ))}
      </select>

        {TIPOS_SEM_VENCIMENTO.includes(arquivo.tipo) ? (
          <span className="shrink-0 px-2 py-1.5 text-xs italic text-navy-soft">Não se aplica</span>
        ) : (
          <input
            type="date"
            value={arquivo.dataVencimento}
            onChange={(event) => onAtualizar(arquivo.id, 'dataVencimento', event.target.value)}
            className="shrink-0 rounded-[3px] border border-rule bg-white px-2 py-1.5 text-xs text-charcoal outline-none focus:border-lime"
          />
        )}

        <button
          type="button"
          onClick={() => onRemover(arquivo.id)}
          className="shrink-0 text-xs font-semibold text-navy-soft hover:text-red-600"
        >
          remover
        </button>
      </div>

      {temAviso && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <IconAlerta className="h-4 w-4 shrink-0" />
          <div className="flex flex-col gap-1">
            {divergenciaSelecao && (
              <p>
                Este arquivo parece ser da empresa{' '}
                <strong>{nomeParaExibicao(arquivo.clienteIdDetectado, clientes)}</strong>, mas você selecionou{' '}
                <strong>{nomeParaExibicao(arquivo.clienteId, clientes)}</strong>. Confirme se a troca está certa.
              </p>
            )}
            {divergenciaCnpj && (
              <p>
                O CNPJ encontrado dentro do PDF não bate com o CNPJ cadastrado de{' '}
                <strong>{nomeParaExibicao(arquivo.clienteId, clientes)}</strong>. Confira se é o cliente certo.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

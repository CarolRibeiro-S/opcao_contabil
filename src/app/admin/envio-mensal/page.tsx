'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TIPOS_PADRAO,
  TIPOS_SEM_VENCIMENTO,
  type ArquivoRevisado,
  type ClienteOption,
  type ProfissionalOption,
} from '@/lib/envioMensal'
import EnvioMensalArquivos from '@/components/admin/EnvioMensalArquivos'
import EnvioMensalConfirmacao from '@/components/admin/EnvioMensalConfirmacao'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

const ETAPAS = [
  { numero: 1, titulo: 'Competência' },
  { numero: 2, titulo: 'Upload e reconhecimento' },
  { numero: 3, titulo: 'Confirmação e envio' },
] as const

function tipoMaisFrequente(datas: string[]) {
  const contagem = new Map<string, number>()
  for (const data of datas) {
    contagem.set(data, (contagem.get(data) ?? 0) + 1)
  }

  let escolhida = datas[0]
  let maiorContagem = 0
  for (const [data, quantidade] of contagem) {
    if (quantidade > maiorContagem) {
      maiorContagem = quantidade
      escolhida = data
    }
  }

  return escolhida
}

export default function EnvioMensalPage() {
  const supabase = createClient()

  const [etapa, setEtapa] = useState(1)
  const [competencia, setCompetencia] = useState('')

  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [profissionais, setProfissionais] = useState<ProfissionalOption[]>([])
  const [arquivosRevisados, setArquivosRevisados] = useState<ArquivoRevisado[]>([])

  useEffect(() => {
    async function carregarClientes() {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome_empresa, apelido, email, cnpj_cpf')
        .eq('status', 'ativo')
        .order('nome_empresa', { ascending: true })

      setClientes(data ?? [])

      const idsAtivos = (data ?? []).map((cliente) => cliente.id)
      if (idsAtivos.length === 0) return

      const { data: profissionaisData } = await supabase
        .from('profissionais_clinica')
        .select('cliente_id, nome')
        .in('cliente_id', idsAtivos)

      setProfissionais(
        (profissionaisData ?? []).map((profissional) => ({
          clienteId: profissional.cliente_id,
          nome: profissional.nome,
        }))
      )
    }

    carregarClientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function registrarHistoricoImpostosMes(arquivos: ArquivoRevisado[]) {
    const datasPorTipo = new Map<string, string[]>()

    for (const arquivo of arquivos) {
      if (!arquivo.tipo || !arquivo.dataVencimento || TIPOS_SEM_VENCIMENTO.includes(arquivo.tipo)) continue
      const lista = datasPorTipo.get(arquivo.tipo) ?? []
      lista.push(arquivo.dataVencimento)
      datasPorTipo.set(arquivo.tipo, lista)
    }

    if (datasPorTipo.size === 0) return

    const linhas = Array.from(datasPorTipo.entries()).map(([tipo, datas]) => ({
      competencia: `${competencia}-01`,
      tipo,
      data_vencimento: tipoMaisFrequente(datas),
    }))

    await supabase.from('impostos_mes').upsert(linhas, { onConflict: 'competencia,tipo' })
  }

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold text-navy">Envio Mensal de Impostos</h1>
      <p className="mb-8 text-sm text-navy-soft">
        Envie os impostos e vencimentos do mês para todos os clientes de uma vez.
      </p>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        {ETAPAS.map((item, index) => (
          <div key={item.numero} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
                etapa === item.numero
                  ? 'bg-navy text-paper'
                  : etapa > item.numero
                    ? 'bg-lime text-navy'
                    : 'bg-paper-dim text-navy-soft'
              }`}
            >
              {etapa > item.numero ? '✓' : item.numero}
            </div>
            <span className={`text-sm ${etapa === item.numero ? 'font-semibold text-navy' : 'text-navy-soft'}`}>
              {item.titulo}
            </span>
            {index < ETAPAS.length - 1 && <span className="mx-1 h-px w-8 bg-rule" />}
          </div>
        ))}
      </div>

      {etapa === 1 && (
        <div className="max-w-md">
          <div className="mb-6">
            <label htmlFor="competencia" className={labelClasses}>
              Competência
            </label>
            <input
              id="competencia"
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className={inputClasses}
            />
          </div>

          <p className="mb-6 text-sm text-navy-soft">
            O CNPJ e a data de vencimento de cada imposto serão lidos automaticamente de dentro dos
            documentos enviados na próxima etapa.
          </p>

          <button
            type="button"
            onClick={() => setEtapa(2)}
            disabled={!competencia}
            className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continuar
          </button>
        </div>
      )}

      {etapa === 2 && (
        <EnvioMensalArquivos
          clientes={clientes}
          profissionais={profissionais}
          tiposDisponiveis={TIPOS_PADRAO}
          arquivosIniciais={arquivosRevisados}
          onVoltar={() => setEtapa(1)}
          onContinuar={async (arquivos) => {
            setArquivosRevisados(arquivos)
            await registrarHistoricoImpostosMes(arquivos)
            setEtapa(3)
          }}
        />
      )}

      {etapa === 3 && (
        <EnvioMensalConfirmacao
          competencia={competencia}
          clientes={clientes}
          arquivosRevisados={arquivosRevisados}
          onVoltar={() => setEtapa(2)}
        />
      )}
    </div>
  )
}

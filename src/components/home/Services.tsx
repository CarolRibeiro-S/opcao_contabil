'use client'

import { useState } from 'react'

const services = [
  {
    num: '01',
    title: 'Abertura de Empresa',
    desc: 'Escolha de regime tributário, registro e licenças — sua empresa pronta para operar sem dor de cabeça.',
    topicos: [
      'Definição do regime tributário mais vantajoso (MEI, Simples Nacional, Lucro Presumido) conforme a atividade',
      'Escolha do CNAE correto — impacta diretamente na alíquota de imposto',
      'Elaboração do contrato social ou requerimento de empresário',
      'Registro na Junta Comercial e obtenção do NIRE',
      'Inscrição no CNPJ junto à Receita Federal',
      'Inscrições estadual e municipal, quando aplicável',
      'Emissão de alvará e licenças necessárias pro funcionamento',
      'Emissão do certificado digital, obrigatório pra nota fiscal eletrônica',
    ],
  },
  {
    num: '02',
    title: 'Escrituração Contábil',
    desc: 'Balanços e demonstrativos atualizados, para você decidir com números confiáveis.',
    topicos: [
      'Registro organizado de todas as movimentações financeiras da empresa',
      'Elaboração do Balanço Patrimonial e da Demonstração de Resultado (DRE)',
      'Livro Diário e Livro Razão sempre atualizados, conforme a legislação',
      'Base confiável pra tomada de decisão com números reais',
      'Suporte na busca por crédito ou financiamento bancário',
    ],
  },
  {
    num: '03',
    title: 'Folha de Pagamento',
    desc: 'Cálculo, encargos e obrigações trabalhistas em dia, todo mês.',
    topicos: [
      'Cálculo mensal de salários, horas extras, adicionais e benefícios',
      'Apuração de encargos trabalhistas (INSS, FGTS, IRRF)',
      'Emissão de holerites e guias de recolhimento',
      'Controle de férias, 13º salário e rescisões',
      'Admissões e desligamentos dentro da legislação vigente',
      'Envio de informações via e-Social',
    ],
  },
  {
    num: '04',
    title: 'Apuração de Impostos',
    desc: 'Guias calculadas e conferidas antes de cada vencimento.',
    topicos: [
      'Levantamento mensal do faturamento e das despesas dedutíveis',
      'Cálculo dos tributos conforme o regime da empresa',
      'Emissão das guias já prontas pra pagamento (DARF, DAS)',
      'Conferência cruzada com notas fiscais emitidas e recebidas',
      'Planejamento tributário pra reduzir a carga de forma legal',
    ],
  },
  {
    num: '05',
    title: 'Obrigações Acessórias',
    desc: 'e-Social, DCTFWeb, EFD-Reinf, SPED Fiscal e outras — prazos monitorados por sistema, não por memória.',
    topicos: [
      'Envio de declarações mensais, trimestrais e anuais exigidas pelo Fisco',
      'Controle de prazo de cada obrigação, conforme o regime da empresa',
      'Prevenção de multas por atraso ou omissão',
      'Guarda organizada de todos os comprovantes de envio',
    ],
  },
  {
    num: '06',
    title: 'Contabilidade para Clínicas',
    desc: 'Apuração individualizada por médico: faturamento, imposto devido e repasse, sem planilha manual.',
    topicos: [
      'Apuração individualizada do faturamento de cada profissional',
      'Cálculo do imposto devido por médico, considerando o regime de cada um',
      'Rateio automático de receitas entre os profissionais da clínica',
      'Relatório mensal por médico, facilitando o repasse de valores',
      'Suporte às particularidades tributárias do setor de saúde',
    ],
  },
]

export default function Services() {
  const [expandido, setExpandido] = useState<string | null>(null)

  function alternar(num: string) {
    setExpandido((atual) => (atual === num ? null : num))
  }

  return (
    <section id="servicos" className="bg-navy py-[84px] text-paper">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="reveal mb-12 max-w-[600px]">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-lime-bright">O que fazemos</p>
          <h2 className="mt-2.5 font-display text-[clamp(27px,3vw,36px)] font-semibold tracking-[-0.01em] text-white">
            Serviços contábeis, linha a linha
          </h2>
          <p className="mt-3.5 text-base text-[#c4cbe0]">
            Do abrir ao declarar — cada etapa da vida fiscal da sua empresa, acompanhada de perto.
          </p>
        </div>

        <div className="border-t border-white/15">
          {services.map((service) => {
            const aberto = expandido === service.num

            return (
              <div key={service.num} className="reveal border-b border-white/15">
                <button
                  type="button"
                  onClick={() => alternar(service.num)}
                  aria-expanded={aberto}
                  className="grid w-full grid-cols-[40px_1fr] items-center gap-6 py-6 text-left transition-[padding-left,background-color] duration-[250ms] ease-out hover:bg-white/5 hover:pl-3.5 sm:grid-cols-[70px_1fr]"
                >
                  <div className="flex flex-col items-start gap-2">
                    <span className="font-mono text-[13px] text-lime-bright">{service.num}</span>
                    <span
                      aria-hidden="true"
                      className={`text-sm text-lime-bright transition-transform duration-300 ease-out ${
                        aberto ? 'rotate-180' : ''
                      }`}
                    >
                      ▾
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-medium">{service.title}</h3>
                    <p className="mt-1.5 max-w-[520px] text-[14.5px] text-[#c4cbe0]">{service.desc}</p>
                  </div>
                </button>

                <div
                  className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out ${
                    aberto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="min-h-0">
                    <ul className="grid grid-cols-1 gap-x-8 gap-y-2 py-6 pl-[46px] sm:grid-cols-2 sm:pl-[76px]">
                      {service.topicos.map((topico) => (
                        <li key={topico} className="flex gap-2 text-[13.5px] leading-relaxed text-[#c4cbe0]">
                          <span className="mt-[3px] shrink-0 text-lime-bright" aria-hidden="true">
                            ›
                          </span>
                          <span>{topico}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

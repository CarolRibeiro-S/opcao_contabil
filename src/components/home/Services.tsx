const services = [
  {
    num: '01',
    title: 'Abertura de Empresa',
    desc: 'Escolha de regime tributário, registro e licenças — sua empresa pronta para operar sem dor de cabeça.',
  },
  {
    num: '02',
    title: 'Escrituração Contábil',
    desc: 'Balanços e demonstrativos atualizados, para você decidir com números confiáveis.',
  },
  {
    num: '03',
    title: 'Folha de Pagamento',
    desc: 'Cálculo, encargos e obrigações trabalhistas em dia, todo mês.',
  },
  {
    num: '04',
    title: 'Apuração de Impostos',
    desc: 'Guias calculadas e conferidas antes de cada vencimento.',
  },
  {
    num: '05',
    title: 'Obrigações Acessórias',
    desc: 'e-Social, DCTFWeb, EFD-Reinf, SPED Fiscal e outras — prazos monitorados por sistema, não por memória.',
  },
  {
    num: '06',
    title: 'Contabilidade para Clínicas',
    desc: 'Apuração individualizada por médico: faturamento, imposto devido e repasse, sem planilha manual.',
  },
]

export default function Services() {
  return (
    <section id="servicos" className="bg-navy py-[84px] text-paper">
      <div className="mx-auto max-w-[1180px] px-8">
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
          {services.map((service) => (
            <div
              key={service.num}
              className="reveal group grid grid-cols-[40px_1fr] items-center gap-6 border-b border-white/15 py-6 transition-[padding-left,background-color] duration-[250ms] ease-out hover:bg-white/5 hover:pl-3.5 sm:grid-cols-[70px_1fr_auto]"
            >
              <span className="font-mono text-[13px] text-lime-bright">{service.num}</span>
              <div>
                <h3 className="font-display text-xl font-medium">{service.title}</h3>
                <p className="mt-1.5 max-w-[520px] text-[14.5px] text-[#c4cbe0]">{service.desc}</p>
              </div>
              <span className="hidden font-mono text-xl text-lime-bright opacity-0 transition-all duration-[250ms] ease-out group-hover:translate-x-1 group-hover:opacity-100 sm:block">
                →
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

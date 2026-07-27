const items = [
  {
    icon: '⏰',
    title: 'Alertas automáticos',
    desc: 'Acompanhamos cada vencimento da sua empresa de perto. Você é avisado antes do prazo chegar, nunca depois da multa.',
  },
  {
    icon: '◔',
    title: 'Portal do Cliente',
    desc: 'Sempre que precisar saber como está sua situação fiscal, é só acessar — sem esperar resposta, sem precisar ligar.',
  },
  {
    icon: '▤',
    title: 'Dashboard em tempo real',
    desc: 'Transparência total: você sabe exatamente como está cada obrigação da sua empresa, o tempo todo.',
  },
]

export default function Diferencial() {
  return (
    <section id="diferencial" className="py-[84px]">
      <div className="mx-auto max-w-[1180px] px-8">
        <div className="reveal mb-12 max-w-[600px]">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-navy-soft">Diferencial</p>
          <h2 className="mt-2.5 font-display text-[clamp(27px,3vw,36px)] font-semibold tracking-[-0.01em] text-navy">
            Seu prazo é nosso compromisso
          </h2>
          <p className="mt-3.5 text-base text-[#55564a]">
            Contabilidade de perto, do jeito que sua empresa merece — sem planilha perdida, sem
            prazo esquecido.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.title}
              className="reveal group relative overflow-hidden rounded-lg border border-rule bg-white p-[30px_26px]
                before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:origin-left before:scale-x-0 before:bg-lime
                before:transition-transform before:duration-[350ms] before:ease-out before:content-[''] hover:before:scale-x-100"
            >
              <div className="mb-[18px] flex h-[46px] w-[46px] items-center justify-center rounded-full border-[1.4px] border-navy font-display text-lg text-navy">
                {item.icon}
              </div>
              <h3 className="mb-2.5 font-display text-[19px] font-semibold text-navy">{item.title}</h3>
              <p className="text-[14.5px] text-[#55564a]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

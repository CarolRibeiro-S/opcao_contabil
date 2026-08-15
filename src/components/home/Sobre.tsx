import Image from 'next/image'

export default function Sobre() {
  return (
    <section id="sobre" className="bg-paper-dim py-[84px]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-10 px-5 sm:px-8 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
        <div className="reveal relative aspect-[4/5] overflow-hidden rounded-[10px] bg-navy">
          <Image
            src="/images/foto-hederson.jpeg"
            alt="Hederson Camelo"
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            className="object-cover"
          />
          <span className="absolute bottom-[22px] left-[22px] rounded-md bg-white/95 px-3.5 py-2.5 font-mono text-[11.5px] tracking-[0.04em] text-navy">
            Hederson Camelo · Gestor responsável
          </span>
        </div>

        <div className="reveal">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-navy-soft">Quem somos</p>
          <h2 className="mt-2 font-display text-[clamp(26px,3vw,34px)] font-semibold text-navy">
            Contabilidade de perto, sem planilha perdida
          </h2>
          <div className="mt-[18px] flex max-w-[540px] flex-col gap-4 text-base text-charcoal-soft">
            <p>
              A Opção Contábil nasceu em 2006, de uma decisão simples: fazer contabilidade de
              verdade, de perto, sem deixar nenhum cliente na mão.
            </p>
            <p>
              Quase duas décadas depois, a essência não mudou — mas o escritório, sim. Hoje à
              frente da gestão, Hederson Camelo cresceu vendo o negócio de dentro, acompanhando
              cada fase da empresa antes mesmo de assumir a linha de frente. Foi ele quem trouxe
              o escritório para o presente: tirou a contabilidade de um servidor físico, levou
              tudo para a nuvem, e modernizou os sistemas para acompanhar o ritmo de quem
              empreende hoje.
            </p>
            <p>
              Ao longo desses anos, já foram mais de 900 empresas atendidas — cada uma com sua
              rotina, seu prazo, sua urgência. É esse volume de experiência que sustenta o jeito
              de trabalhar que une o que sempre funcionou — atenção próxima, compromisso com
              prazo, contabilidade que se importa — com as ferramentas certas para nunca deixar
              passar um vencimento.
            </p>
            <p>
              Somos contadores que usam tecnologia para
              fazer o que sempre fizemos de melhor: cuidar do seu negócio como se fosse nosso.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-10">
            <div>
              <strong className="block font-display text-[30px] text-navy">900+</strong>
              <span className="mt-1 block w-fit rounded-[3px] bg-navy px-1.5 py-0.5 font-mono text-xs uppercase tracking-[0.08em] text-lime-bright">
                Clientes atendidos
              </span>
            </div>
            <div>
              <strong className="block font-display text-[30px] text-navy">11</strong>
              <span className="mt-1 block w-fit rounded-[3px] bg-navy px-1.5 py-0.5 font-mono text-xs uppercase tracking-[0.08em] text-lime-bright">
                Obrigações monitoradas
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

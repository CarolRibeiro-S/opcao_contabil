export default function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[repeating-linear-gradient(180deg,transparent,transparent_37px,var(--rule)_37px,var(--rule)_38px)] py-[92px] pb-[78px]
        after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(180deg,var(--paper)_0%,rgba(247,248,245,0.55)_40%,var(--paper)_100%)] after:content-['']"
    >
      <div className="relative z-[1] mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-14 px-8 md:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-navy-soft">
            Contabilidade orientada a prazos
          </p>
          <h1 className="mt-2.5 font-display text-[clamp(34px,4.4vw,54px)] font-semibold leading-[1.08] tracking-[-0.01em] text-navy">
            Prazo perdido
            <br />
            não é mais <em className="text-lime">desculpa.</em>
          </h1>
          <p className="mt-[22px] max-w-[480px] text-[17px] leading-[1.65] text-[#4a4a3f]">
            Cuidamos da escrituração, dos impostos e das obrigações acessórias da sua empresa
            com um sistema que avisa antes do vencimento — não depois da multa.
          </p>
          <div className="mt-[34px] flex flex-wrap gap-3.5">
            <a
              href="#contato"
              className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)]"
            >
              Solicitar proposta
            </a>
            <a
              href="#servicos"
              className="inline-flex items-center gap-2 rounded-[3px] border-[1.3px] border-navy px-5 py-2.5 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-navy hover:text-paper"
            >
              Ver serviços
            </a>
          </div>
        </div>

        <div className="relative order-first flex items-center justify-center md:order-none">
          <div className="w-full max-w-[320px] animate-panel-in rounded-xl border border-rule bg-white p-5 shadow-[0_20px_40px_rgba(22,35,74,0.14)]">
            <div className="mb-4 flex items-center justify-between border-b border-rule pb-3">
              <span className="font-display text-sm font-semibold text-navy">
                Painel · Opção Contábil
              </span>
              <span className="h-2 w-2 rounded-full bg-lime" />
            </div>

            <div>
              <span className="font-mono text-[42px] font-semibold leading-none text-lime">100%</span>
              <p className="mt-1.5 text-sm text-[#55564a]">dos prazos acompanhados de perto</p>
            </div>

            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-paper-dim">
              <div className="h-full w-full rounded-full bg-lime" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-rule pt-3.5 font-mono text-[11px] text-navy-soft">
              <span>900+ clientes atendidos</span>
              <span>11 obrigações monitoradas</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

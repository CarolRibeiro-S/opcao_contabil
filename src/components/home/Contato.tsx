const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

export default function Contato() {
  return (
    <section id="contato" className="py-[84px]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-14 px-8 md:grid-cols-2">
        <div className="reveal">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-navy-soft">Fale com a gente</p>
          <h2 className="mt-2 font-display text-[30px] font-semibold text-navy">
            Vamos organizar sua contabilidade
          </h2>
          <form className="mt-[30px]">
            <div className="mb-[18px]">
              <label htmlFor="nome" className={labelClasses}>
                Nome
              </label>
              <input id="nome" type="text" placeholder="Seu nome completo" className={inputClasses} />
            </div>
            <div className="mb-[18px]">
              <label htmlFor="email" className={labelClasses}>
                E-mail
              </label>
              <input id="email" type="email" placeholder="seu@email.com" className={inputClasses} />
            </div>
            <div className="mb-[18px]">
              <label htmlFor="msg" className={labelClasses}>
                Mensagem
              </label>
              <textarea
                id="msg"
                placeholder="Conte um pouco sobre sua empresa"
                className={`min-h-[90px] resize-y ${inputClasses}`}
              />
            </div>
            <button
              type="submit"
              className="mt-2 inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)]"
            >
              Enviar mensagem
            </button>
          </form>
        </div>

        <div className="reveal flex flex-col gap-[26px]">
          <div className="flex gap-4">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.4px] border-navy font-mono text-sm text-navy">
              @
            </div>
            <div>
              <h4 className="font-display text-base font-semibold text-navy">E-mail</h4>
              <a
                href="mailto:opcaocontabilbsb@gmail.com"
                className="mt-[3px] block text-sm text-[#55564a] hover:text-navy"
              >
                opcaocontabilbsb@gmail.com
              </a>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.4px] border-navy font-mono text-sm text-navy">
              ☏
            </div>
            <div>
              <h4 className="font-display text-base font-semibold text-navy">WhatsApp</h4>
              <a
                href="https://wa.me/5561985993552"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-[3px] block text-sm text-[#55564a] hover:text-navy"
              >
                (61) 98599-3552
              </a>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.4px] border-navy font-mono text-sm text-navy">
              ☎
            </div>
            <div>
              <h4 className="font-display text-base font-semibold text-navy">Telefone</h4>
              <p className="mt-[3px] text-sm text-[#55564a]">(61) 3034-6911</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.4px] border-navy font-mono text-sm text-navy">
              ⌂
            </div>
            <div>
              <h4 className="font-display text-base font-semibold text-navy">Endereço</h4>
              <p className="mt-[3px] text-sm text-[#55564a]">Brasília — DF</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.4px] border-navy font-mono text-sm text-navy">
              ◎
            </div>
            <div>
              <h4 className="font-display text-base font-semibold text-navy">Instagram</h4>
              <a
                href="https://www.instagram.com/opcaocontabildf/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-[3px] block text-sm text-[#55564a] hover:text-navy"
              >
                @opcaocontabildf
              </a>
            </div>
          </div>
          <div className="mt-1.5 flex h-[150px] items-center justify-center rounded-lg border border-dashed border-rule bg-[repeating-linear-gradient(135deg,var(--paper-dim),var(--paper-dim)_10px,var(--paper)_10px,var(--paper)_20px)] font-mono text-[11.5px] tracking-[0.06em] text-[#8a8f80]">
            mapa · localização do escritório
          </div>
        </div>
      </div>
    </section>
  )
}

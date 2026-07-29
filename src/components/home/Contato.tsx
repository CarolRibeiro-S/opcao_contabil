import FormularioContato from './FormularioContato'

const ENDERECO_ESCRITORIO =
  'Q 2 Quadra 02 Conjunto A lote 3/5 Sala 111 - Sobradinho I, Brasília - DF, 73015-120'

const MAPA_EMBED_SRC = `https://www.google.com/maps?q=${encodeURIComponent(
  ENDERECO_ESCRITORIO
)}&output=embed`

export default function Contato() {
  return (
    <section id="contato" className="py-[84px]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-10 px-5 sm:px-8 md:grid-cols-2 md:gap-14">
        <div className="reveal">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-navy-soft">Fale com a gente</p>
          <h2 className="mt-2 font-display text-[30px] font-semibold text-navy">
            Vamos organizar sua contabilidade
          </h2>
          <FormularioContato />
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
                href="https://wa.me/5561946699671"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-[3px] block text-sm text-[#55564a] hover:text-navy"
              >
                (61) 9466-9671
              </a>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.4px] border-navy font-mono text-sm text-navy">
              ☎
            </div>
            <div>
              <h4 className="font-display text-base font-semibold text-navy">Telefone</h4>
              <a
                href="tel:+556130346911"
                className="mt-[3px] block text-sm text-[#55564a] hover:text-navy"
              >
                (61) 3034-6911
              </a>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.4px] border-navy font-mono text-sm text-navy">
              ⌂
            </div>
            <div>
              <h4 className="font-display text-base font-semibold text-navy">Endereço</h4>
              <a
                href="https://maps.app.goo.gl/QAqLwPFCToyvXXaP8"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-[3px] block text-sm text-[#55564a] hover:text-navy"
              >
                Q 2 Quadra 02 Conjunto A, Lote 3/5, Sala 111
                <br />
                Sobradinho I, Brasília - DF, 73015-120
              </a>
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
          <div className="mt-1.5 overflow-hidden rounded-lg border border-rule">
            <iframe
              src={MAPA_EMBED_SRC}
              title="Localização da Opção Contábil no Google Maps"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[220px] w-full border-0"
            />
            <a
              href="https://maps.app.goo.gl/QAqLwPFCToyvXXaP8"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white px-3 py-2 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-navy-soft transition-colors duration-200 hover:text-navy"
            >
              Ver no Google Maps
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

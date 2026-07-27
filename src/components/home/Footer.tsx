import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-navy py-14 pb-[26px] text-paper">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-10 px-8 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="font-display text-lg font-semibold text-white">Opção Contábil</div>
          <p className="mt-3.5 max-w-[280px] text-[13.5px] text-[#aab4d6]">
            Contabilidade orientada a prazos, para empresas que não têm tempo a perder.
          </p>
          <a
            href="https://www.instagram.com/opcaocontabildf/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3.5 inline-block text-[13.5px] text-[#c4cbe0] hover:text-lime-bright"
          >
            @opcaocontabildf
          </a>
        </div>

        <div>
          <h5 className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-lime-bright">
            Serviços
          </h5>
          <ul className="space-y-[9px] text-sm text-[#c4cbe0]">
            <li>
              <a href="#servicos" className="hover:text-lime-bright">
                Abertura de Empresa
              </a>
            </li>
            <li>
              <a href="#servicos" className="hover:text-lime-bright">
                Escrituração
              </a>
            </li>
            <li>
              <a href="#servicos" className="hover:text-lime-bright">
                Folha de Pagamento
              </a>
            </li>
            <li>
              <a href="#servicos" className="hover:text-lime-bright">
                Impostos
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h5 className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-lime-bright">
            Acesso
          </h5>
          <ul className="space-y-[9px] text-sm text-[#c4cbe0]">
            <li>
              <Link href="/login" className="hover:text-lime-bright">
                Portal do Cliente
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-lime-bright">
                Painel do Contador
              </Link>
            </li>
            <li>
              <a href="#contato" className="hover:text-lime-bright">
                Contato
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-[46px] max-w-[1180px] border-t border-white/15 px-8 pt-[22px]">
        <div className="flex flex-wrap justify-between gap-2.5 text-[12.5px] text-[#8f9ac0]">
          <span>© 2026 Opção Contábil. Todos os direitos reservados.</span>
          <span>Brasília — DF</span>
        </div>
        <p className="mt-2 text-[11.5px] text-[#6d78a0]">
          Site criado e desenvolvido por{' '}
          <a
            href="https://carolribeiros.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-lime-bright"
          >
            Carol Ribeiro
          </a>
        </p>
      </div>
    </footer>
  )
}

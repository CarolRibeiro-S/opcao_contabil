'use client'

import { useState, useSyncExternalStore } from 'react'

function IconSol({ className }: { className?: string }) {
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
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 1.8v2.1M10 16.1v2.1M18.2 10h-2.1M3.9 10H1.8M15.6 4.4l-1.5 1.5M5.9 14.1l-1.5 1.5M15.6 15.6l-1.5-1.5M5.9 5.9L4.4 4.4" />
    </svg>
  )
}

function IconLua({ className }: { className?: string }) {
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
      <path d="M17.3 11.8A7.5 7.5 0 018.2 2.7a7.5 7.5 0 109.1 9.1z" />
    </svg>
  )
}

// useSyncExternalStore em vez de useEffect+useState: a classe "dark" no
// <html> é estado externo ao React (mexido direto no DOM, tanto pelo script
// anti-flash quanto pelo clique aqui), e essa é a API feita pra ler estado
// assim sem gambiarra de efeito — resolve hidratação sozinha (usa
// lerServidor no primeiro render do servidor, depois troca pro valor real
// do DOM no cliente, sem warning de mismatch) e sem precisar de "useEffect
// só pra sincronizar uma vez no mount".
function inscrever() {
  // Nada além do próprio clique (abaixo) muda a classe "dark", então não
  // há uma fonte externa assíncrona pra "ouvir" — o forceRender após o
  // clique já basta pra React reler lerCliente().
  return () => {}
}

function lerCliente() {
  return document.documentElement.classList.contains('dark')
}

function lerServidor() {
  return false
}

// Lê/grava a preferência em localStorage (chave "tema", valores "escuro" /
// "claro") — mesma chave que o script anti-flash em src/app/layout.tsx lê
// antes da hidratação. Cada instância deste botão (Sidebar, AdminMobileNav,
// Header institucional...) manipula a classe "dark" no <html> diretamente;
// como só uma fica visível por vez em cada página, não precisa de um
// contexto/estado compartilhado entre elas.
export default function ThemeToggle({ className }: { className?: string }) {
  const escuro = useSyncExternalStore(inscrever, lerCliente, lerServidor)
  const [, forcarNovaLeitura] = useState(0)

  function alternar() {
    const novoEscuro = !escuro
    document.documentElement.classList.toggle('dark', novoEscuro)
    try {
      localStorage.setItem('tema', novoEscuro ? 'escuro' : 'claro')
    } catch {
      // localStorage indisponível (modo privado etc) — a troca de tema
      // ainda funciona nesta sessão, só não persiste entre visitas.
    }
    // useSyncExternalStore só relê o DOM quando o componente re-renderiza;
    // esse bump força esse re-render (a mudança em si já foi feita acima).
    forcarNovaLeitura((n) => n + 1)
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={escuro ? 'Modo claro' : 'Modo escuro'}
      className={className}
    >
      {escuro ? <IconSol className="h-5 w-5" /> : <IconLua className="h-5 w-5" />}
    </button>
  )
}

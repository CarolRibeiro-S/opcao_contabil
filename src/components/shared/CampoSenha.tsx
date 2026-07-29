'use client'

import { useState, type InputHTMLAttributes } from 'react'

type CampoSenhaProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

function IconOlhoAberto({ className }: { className?: string }) {
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
      <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6z" />
      <circle cx="10" cy="10" r="2.3" />
    </svg>
  )
}

function IconOlhoFechado({ className }: { className?: string }) {
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
      <path d="M2.3 2.3l15.4 15.4" />
      <path d="M8.1 4.3c.6-.2 1.2-.3 1.9-.3 5.5 0 8.5 6 8.5 6a15.3 15.3 0 01-3.1 3.8M5.3 5.7C2.9 7.3 1.5 10 1.5 10s3 6 8.5 6c1 0 1.9-.2 2.7-.5" />
      <path d="M7.8 7.8a2.3 2.3 0 003.3 3.3" />
    </svg>
  )
}

export default function CampoSenha({ className, ...props }: CampoSenhaProps) {
  const [visivel, setVisivel] = useState(false)

  return (
    <div className="relative">
      <input
        {...props}
        type={visivel ? 'text' : 'password'}
        className={className}
        style={{ paddingRight: '2.75rem' }}
      />
      <button
        type="button"
        onClick={() => setVisivel((atual) => !atual)}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-[#8f9ac0] transition-colors duration-200 hover:text-[#223468]"
      >
        {visivel ? <IconOlhoFechado className="h-5 w-5" /> : <IconOlhoAberto className="h-5 w-5" />}
      </button>
    </div>
  )
}

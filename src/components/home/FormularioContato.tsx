'use client'

import { useState, type FormEvent } from 'react'

const inputClasses =
  'w-full border-0 border-b-[1.4px] border-rule bg-transparent px-0.5 py-2.5 font-body text-[15px] text-charcoal outline-none transition-colors duration-200 focus:border-lime'

const labelClasses =
  'mb-[7px] block font-mono text-[11px] uppercase tracking-[0.1em] text-navy-soft'

type StatusEnvio = 'idle' | 'enviando' | 'sucesso' | 'erro'

export default function FormularioContato() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [status, setStatus] = useState<StatusEnvio>('idle')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('enviando')

    try {
      const resposta = await fetch('https://formspree.io/f/mlgqzrek', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ nome, email, mensagem }),
      })

      if (resposta.ok) {
        setStatus('sucesso')
        setNome('')
        setEmail('')
        setMensagem('')
      } else {
        setStatus('erro')
      }
    } catch {
      setStatus('erro')
    }
  }

  if (status === 'sucesso') {
    return (
      <div className="mt-[30px] flex items-start gap-3 rounded-lg border border-lime/40 bg-lime/10 p-5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime text-sm font-semibold text-navy">
          ✓
        </span>
        <p className="text-sm font-medium text-navy">Mensagem enviada! Retornamos o quanto antes.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-[30px]">
      <div className="mb-[18px]">
        <label htmlFor="nome" className={labelClasses}>
          Nome
        </label>
        <input
          id="nome"
          type="text"
          required
          placeholder="Seu nome completo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={inputClasses}
        />
      </div>
      <div className="mb-[18px]">
        <label htmlFor="email" className={labelClasses}>
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
        />
      </div>
      <div className="mb-[18px]">
        <label htmlFor="msg" className={labelClasses}>
          Mensagem
        </label>
        <textarea
          id="msg"
          required
          placeholder="Conte um pouco sobre sua empresa"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          className={`min-h-[90px] resize-y ${inputClasses}`}
        />
      </div>

      <button
        type="submit"
        disabled={status === 'enviando'}
        className="mt-2 inline-flex items-center gap-2 rounded-[3px] bg-lime px-5 py-2.5 text-sm font-semibold text-navy transition duration-200 hover:-translate-y-px hover:bg-lime-bright hover:shadow-[0_6px_16px_rgba(141,198,63,0.4)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
      >
        {status === 'enviando' ? 'Enviando...' : 'Enviar mensagem'}
      </button>

      {status === 'erro' && (
        <p className="mt-3 text-sm text-red-600">
          Não foi possível enviar. Tente novamente ou fale pelo WhatsApp.
        </p>
      )}
    </form>
  )
}

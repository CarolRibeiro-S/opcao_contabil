'use client'

import type { ChangeEvent } from 'react'

type CampoTelefoneProps = {
  valor: string
  onChange: (valor: string) => void
  id?: string
  name?: string
  required?: boolean
  className?: string
  placeholder?: string
}

// Detecta celular (11 dígitos, com o 9) vs fixo (10 dígitos) pela
// quantidade de dígitos já digitados. Diferente do CampoDocumento/
// CampoMoeda, aqui a formatação é da esquerda pra direita — o DDD vem
// primeiro e fica fixo assim que digitado, natural pra telefone.
function formatarTelefone(digitos: string) {
  if (digitos.length <= 10) {
    return digitos.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }

  return digitos.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

export default function CampoTelefone({
  valor,
  onChange,
  id,
  name,
  required,
  className,
  placeholder,
}: CampoTelefoneProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // Limita a 11 dígitos (celular com DDD) mantendo os primeiros digitados
    // — diferente do CampoDocumento, aqui o excedente é ignorado, não
    // desloca o que já foi digitado.
    const digitos = event.target.value.replace(/\D/g, '').slice(0, 11)
    onChange(formatarTelefone(digitos))
  }

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="tel"
      autoComplete="off"
      required={required}
      placeholder={placeholder ?? '(00) 00000-0000'}
      value={valor}
      onChange={handleChange}
      className={className}
    />
  )
}

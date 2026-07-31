'use client'

import type { ChangeEvent } from 'react'

type CampoDocumentoProps = {
  valor: string
  onChange: (valor: string) => void
  id?: string
  name?: string
  required?: boolean
  className?: string
  placeholder?: string
}

// Detecta CPF (até 11 dígitos) vs CNPJ (12 a 14 dígitos) pela quantidade de
// dígitos já digitados e aplica a pontuação correspondente. O valor exposto
// pro pai já vem formatado (com pontos/traço/barra) — é assim que a coluna
// cnpj_cpf já é salva hoje, então não muda o formato de armazenamento.
function formatarDocumento(digitos: string) {
  if (digitos.length <= 11) {
    return digitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  return digitos
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export default function CampoDocumento({
  valor,
  onChange,
  id,
  name,
  required,
  className,
  placeholder,
}: CampoDocumentoProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // Recalcula do zero a cada tecla a partir dos dígitos do texto inteiro
    // (mesma técnica robusta do CampoMoeda) — funciona bem com backspace,
    // colar e edição no meio do texto. Limita a 14 dígitos (tamanho do
    // CNPJ) entrando pela direita: se passar disso, o dígito mais antigo
    // cai fora, como um visor de caixa eletrônico.
    const digitos = event.target.value.replace(/\D/g, '').slice(-14)
    onChange(formatarDocumento(digitos))
  }

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      required={required}
      placeholder={placeholder ?? 'CPF ou CNPJ'}
      value={valor}
      onChange={handleChange}
      className={className}
    />
  )
}

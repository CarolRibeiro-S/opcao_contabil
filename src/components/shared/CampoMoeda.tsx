'use client'

import { useState, type ChangeEvent } from 'react'

type CampoMoedaProps = {
  valor: number | null
  onChange: (valor: number | null) => void
  id?: string
  name?: string
  required?: boolean
  disabled?: boolean
  className?: string
  placeholder?: string
}

function formatarCentavos(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function valorInicialFormatado(valor: number | null) {
  if (valor === null || Number.isNaN(valor)) return ''
  return formatarCentavos(Math.round(valor * 100))
}

// Formata como moeda brasileira enquanto o usuário digita, entrando dígito a
// dígito pela direita (igual visor de maquininha de cartão): cada tecla
// pressionada empurra os dígitos existentes uma casa pra esquerda, e as duas
// últimas casas são sempre os centavos. Internamente guarda só os dígitos
// (centavos como inteiro) e expõe pro pai o valor numérico em reais.
export default function CampoMoeda({
  valor,
  onChange,
  id,
  name,
  required,
  disabled,
  className,
  placeholder,
}: CampoMoedaProps) {
  const [exibicao, setExibicao] = useState(() => valorInicialFormatado(valor))

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const somenteDigitos = event.target.value.replace(/\D/g, '')

    if (!somenteDigitos) {
      setExibicao('')
      onChange(null)
      return
    }

    const centavos = Number(somenteDigitos)
    setExibicao(formatarCentavos(centavos))
    onChange(centavos / 100)
  }

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      required={required}
      disabled={disabled}
      placeholder={placeholder ?? '0,00'}
      value={exibicao}
      onChange={handleChange}
      className={className}
    />
  )
}

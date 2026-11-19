// Checagem de formato simples, não de existência real do domínio — mesmo
// regex já usado em api/clientes/atualizar-email-acesso/route.ts, agora
// compartilhado. Objetivo é só pegar o caso óbvio (string vazia, "sem @",
// "sem domínio") ANTES de gastar uma chamada à Resend com algo que nunca
// teria chance de ser entregue — não substitui a confirmação de entrega
// real (envioRealmenteTeveSucesso), que continua sendo quem pega bounce de
// endereço bem formado mas inexistente.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailTemFormatoValido(email: string | null | undefined): boolean {
  if (!email) return false
  return EMAIL_REGEX.test(email.trim())
}

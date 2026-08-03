import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type ComunicadoNaoVisto = {
  id: string
  clientes: { nome_empresa: string } | null
}

function IconSino({ className }: { className?: string }) {
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
      <path d="M5 8a5 5 0 0 1 10 0c0 3.2 1 4.5 1.6 5.2.3.3.1.8-.3.8H3.7c-.4 0-.6-.5-.3-.8C4 12.5 5 11.2 5 8Z" />
      <path d="M8.2 16.5a1.8 1.8 0 0 0 3.6 0" />
    </svg>
  )
}

// Comunicado com status='respondido' e visto_em nulo = o cliente respondeu
// por último e nenhum admin abriu essa conversa ainda desde então (ver
// ThreadComunicado.tsx: visto_em zera a cada mensagem nova do cliente e é
// marcado com now() quando um admin abre a thread).
export default async function NotificacoesRespostas() {
  const supabase = await createClient()

  const { data: naoVistos } = await supabase
    .from('comunicados')
    .select('id, clientes(nome_empresa)')
    .eq('status', 'respondido')
    .is('visto_em', null)
    .order('created_at', { ascending: false })
    .limit(10)
    .returns<ComunicadoNaoVisto[]>()

  const lista = naoVistos ?? []

  if (lista.length === 0) return null

  const nomes = lista.map((comunicado) => comunicado.clientes?.nome_empresa ?? 'Cliente')
  const nomesVisiveis = nomes.slice(0, 3)
  const restantes = nomes.length - nomesVisiveis.length
  const plural = lista.length > 1 ? 's' : ''

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <IconSino className="h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800">
          Você tem {lista.length} nova{plural} resposta{plural}: <strong>{nomesVisiveis.join(', ')}</strong>
          {restantes > 0 && ` + ${restantes} outro${restantes > 1 ? 's' : ''}`}
        </p>
      </div>
      <Link
        href="/admin/comunicados"
        className="shrink-0 text-sm font-semibold text-amber-800 underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-amber-900"
      >
        Ver comunicados
      </Link>
    </div>
  )
}

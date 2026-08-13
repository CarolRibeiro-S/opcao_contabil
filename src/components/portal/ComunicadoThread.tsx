'use client'

import { useState } from 'react'
import { IconChevron } from '@/components/shared/icons'
import ThreadComunicado from '@/components/shared/ThreadComunicado'

export default function ComunicadoThread({
  comunicadoId,
  clienteId,
  tipoComunicado,
  tituloComunicado,
  nomeCliente,
  statusComunicado,
  requerResposta,
  visualizadoPeloClienteEm,
}: {
  comunicadoId: string
  clienteId: string
  tipoComunicado: 'aviso' | 'solicitacao_documento'
  tituloComunicado: string
  nomeCliente: string
  statusComunicado: string
  requerResposta: boolean
  visualizadoPeloClienteEm: string | null
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        className="flex items-center gap-1.5 text-xs font-semibold text-navy-soft underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-navy"
      >
        {aberto ? 'Ocultar conversa' : 'Ver conversa'}
        <IconChevron className={`h-3 w-3 transition-transform duration-200 ${aberto ? 'rotate-90' : ''}`} />
      </button>

      {aberto && (
        <div className="mt-3">
          <ThreadComunicado
            comunicadoId={comunicadoId}
            clienteId={clienteId}
            tipoComunicado={tipoComunicado}
            autorTipo="cliente"
            tituloComunicado={tituloComunicado}
            nomeCliente={nomeCliente}
            statusAtual={statusComunicado}
            requerResposta={requerResposta}
            visualizadoPeloClienteEm={visualizadoPeloClienteEm}
          />
        </div>
      )}
    </div>
  )
}

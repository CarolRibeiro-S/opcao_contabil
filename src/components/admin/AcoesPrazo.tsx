'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useMenuAncorado } from '@/hooks/useMenuAncorado'
import { registrarHistoricoAtividade } from '@/lib/historicoAtividade'
import { sanitizarNomeArquivo } from '@/lib/storage/sanitizarNomeArquivo'

// Comprovante reaproveita o bucket "documentos-clientes" (já com upload/
// leitura funcionando pra admin, sem precisar criar bucket + políticas de
// RLS novas) mas com um prefixo próprio ("comprovantes/"), separado dos
// caminhos "${clienteId}/..." usados pelos documentos do cliente — assim
// nunca colide com eles, e como nada disso é inserido na tabela
// documentos_clientes, o comprovante nunca aparece no Portal do cliente
// (a listagem de lá é por linha da tabela, não por pasta do Storage).
const BUCKET_COMPROVANTES = 'documentos-clientes'

export default function AcoesPrazo({
  id,
  entidadeNome,
  comprovanteUrl,
  onComprovanteAnexado,
  onComprovanteRemovido,
}: {
  id: string
  entidadeNome: string
  comprovanteUrl: string | null
  onComprovanteAnexado: (comprovanteUrl: string, entregueEm: string) => void
  onComprovanteRemovido: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const { aberto, setAberto, posicao, botaoRef, painelRef, alternar } = useMenuAncorado()
  const [carregando, setCarregando] = useState(false)
  const inputArquivoRef = useRef<HTMLInputElement>(null)

  async function excluir() {
    const confirmado = window.confirm(
      'Tem certeza que deseja excluir este prazo? Essa ação não pode ser desfeita.'
    )
    if (!confirmado) return

    setCarregando(true)

    const { error } = await supabase.from('prazos').delete().eq('id', id)

    setCarregando(false)
    setAberto(false)

    if (error) {
      window.alert('Não foi possível excluir o prazo. Tente novamente.')
      return
    }

    registrarHistoricoAtividade({
      acao: 'excluiu',
      entidade: 'prazo',
      entidadeId: id,
      entidadeNome,
    })

    router.refresh()
  }

  function acionarSeletorArquivo() {
    setAberto(false)
    inputArquivoRef.current?.click()
  }

  async function anexarComprovante(arquivo: File) {
    setCarregando(true)

    const caminhoArquivo = `comprovantes/${id}/${Date.now()}-${sanitizarNomeArquivo(arquivo.name)}`

    const { error: uploadError } = await supabase.storage.from(BUCKET_COMPROVANTES).upload(caminhoArquivo, arquivo)

    if (uploadError) {
      setCarregando(false)
      window.alert('Não foi possível enviar o comprovante. Tente novamente.')
      return
    }

    const entregueEm = new Date().toISOString()

    // status='em_dia' aqui é o que faz a Etapa 1 do cron (cron/prazos/
    // route.ts) parar de mexer nesse prazo por data — ela só busca prazos
    // com status 'pendente'/'atencao', então uma vez em 'em_dia' ele fica
    // de fora automaticamente, mesmo que a data de vencimento já tenha
    // passado ou volte a passar no futuro.
    const { error: updateError } = await supabase
      .from('prazos')
      .update({ comprovante_url: caminhoArquivo, entregue_em: entregueEm, status: 'em_dia' })
      .eq('id', id)

    setCarregando(false)

    if (updateError) {
      window.alert('Comprovante enviado, mas houve um erro ao registrar no prazo. Tente novamente.')
      return
    }

    onComprovanteAnexado(caminhoArquivo, entregueEm)

    registrarHistoricoAtividade({
      acao: 'anexou_documento',
      entidade: 'prazo',
      entidadeId: id,
      entidadeNome,
      detalhes: `Comprovante anexado: ${arquivo.name}`,
    })
  }

  function handleArquivoSelecionado(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (arquivo) anexarComprovante(arquivo)
  }

  async function removerComprovante() {
    const confirmado = window.confirm(
      'Remover o comprovante deste prazo? Ele volta a ser regido pela data de vencimento normalmente.'
    )
    if (!confirmado) return

    setCarregando(true)
    setAberto(false)

    // Só desvincula do prazo (comprovante_url/entregue_em) — não apaga o
    // arquivo do Storage. Mantém o histórico físico caso a remoção tenha
    // sido em cima de um comprovante que, na verdade, era válido.
    const { error } = await supabase
      .from('prazos')
      .update({ comprovante_url: null, entregue_em: null })
      .eq('id', id)

    setCarregando(false)

    if (error) {
      window.alert('Não foi possível remover o comprovante. Tente novamente.')
      return
    }

    onComprovanteRemovido()

    registrarHistoricoAtividade({
      acao: 'editou',
      entidade: 'prazo',
      entidadeId: id,
      entidadeNome,
      detalhes: 'Comprovante removido',
    })
  }

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={alternar}
        aria-label="Abrir ações"
        aria-expanded={aberto}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-navy-soft transition-colors duration-200 hover:bg-paper-dim hover:text-navy"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <circle cx="4" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="16" cy="10" r="1.6" />
        </svg>
      </button>

      <input
        ref={inputArquivoRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={handleArquivoSelecionado}
      />

      {aberto &&
        createPortal(
          <div
            ref={painelRef}
            style={{ position: 'fixed', top: posicao.top, left: posicao.left, transform: 'translateX(-100%)' }}
            className="z-[100] w-48 overflow-hidden rounded-lg border border-rule bg-white py-1 shadow-lg"
          >
            <Link
              href={`/admin/prazos/${id}/editar`}
              className="block px-4 py-2 text-sm text-charcoal transition-colors duration-200 hover:bg-paper-dim"
            >
              Editar
            </Link>

            <div className="my-1 border-t border-rule" />

            {comprovanteUrl ? (
              <button
                type="button"
                onClick={removerComprovante}
                disabled={carregando}
                className="block w-full px-4 py-2 text-left text-sm text-charcoal transition-colors duration-200 hover:bg-paper-dim disabled:opacity-50"
              >
                Remover comprovante
              </button>
            ) : (
              <button
                type="button"
                onClick={acionarSeletorArquivo}
                disabled={carregando}
                className="block w-full px-4 py-2 text-left text-sm text-charcoal transition-colors duration-200 hover:bg-paper-dim disabled:opacity-50"
              >
                Anexar comprovante
              </button>
            )}

            <div className="my-1 border-t border-rule" />

            <button
              type="button"
              onClick={excluir}
              disabled={carregando}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 transition-colors duration-200 hover:bg-red-50 disabled:opacity-50"
            >
              Excluir
            </button>
          </div>,
          document.body
        )}
    </>
  )
}

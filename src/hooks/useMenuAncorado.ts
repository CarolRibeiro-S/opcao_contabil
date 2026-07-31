'use client'

import { useEffect, useRef, useState } from 'react'

type Posicao = { top: number; left: number }

// Estado + posicionamento compartilhado pelos menus "⋮" (AcoesCliente,
// AcoesEquipe, AcoesDespesa, AcoesReceita, ...). O painel deles é renderizado
// via createPortal direto em document.body — assim ele escapa de qualquer
// container com overflow-x-auto/overflow-hidden no meio do caminho (como as
// tabelas com rolagem horizontal), que antes cortava ou empurrava o menu pra
// dentro da área de scroll. Como o painel sai da árvore normal do botão, a
// posição precisa ser calculada na mão (via getBoundingClientRect) e o
// "clicar fora pra fechar" precisa considerar os dois refs (botão e painel)
// em vez de um wrapper único.
export function useMenuAncorado() {
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState<Posicao>({ top: 0, left: 0 })
  const botaoRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)

  function alternar() {
    if (aberto) {
      setAberto(false)
      return
    }

    const retangulo = botaoRef.current?.getBoundingClientRect()
    if (retangulo) {
      // left = borda direita do botão; o painel usa transform:
      // translateX(-100%) pra ficar com a borda direita alinhada ali,
      // reproduzindo o antigo "absolute right-0" independente da largura
      // de cada menu (w-40, w-44, w-48, w-56...).
      setPosicao({ top: retangulo.bottom + 4, left: retangulo.right })
    }

    setAberto(true)
  }

  useEffect(() => {
    if (!aberto) return

    function fecharAoClicarFora(event: MouseEvent) {
      const alvo = event.target as Node
      if (botaoRef.current?.contains(alvo) || painelRef.current?.contains(alvo)) {
        return
      }
      setAberto(false)
    }

    // Sem isso, rolar a tabela (ou a página) com o menu aberto deixaria o
    // painel "flutuando" longe do botão, já que a posição é calculada só na
    // abertura. Fechar ao rolar é o comportamento mais simples e previsível.
    function fecharAoRolar() {
      setAberto(false)
    }

    document.addEventListener('mousedown', fecharAoClicarFora)
    window.addEventListener('scroll', fecharAoRolar, true)
    window.addEventListener('resize', fecharAoRolar)

    return () => {
      document.removeEventListener('mousedown', fecharAoClicarFora)
      window.removeEventListener('scroll', fecharAoRolar, true)
      window.removeEventListener('resize', fecharAoRolar)
    }
  }, [aberto])

  return { aberto, setAberto, posicao, botaoRef, painelRef, alternar }
}

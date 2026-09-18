import {
  avaliarConflitoApelidoExtra,
  candidatosPorApelido,
  candidatosPorNomeEmpresa,
  extrairFrasesCandidatas,
  palavrasSignificativasNomeEmpresa,
  type ClienteOption,
} from './envioMensal'

// Reproduz, pra cada cliente, o "pior caso" de colisão por nome: testa
// cada palavra significativa do nome_empresa como se fosse um nome de
// arquivo sozinho, e vê se bate em mais de um cliente ao mesmo tempo —
// mesma lógica da varredura geral feita na investigação anterior (que
// achou os 61 pares/35 ambíguos), só que devolvendo o CONJUNTO de
// clientes envolvidos, não a lista de pares.
export function identificarClientesEmParesAmbiguos(clientes: ClienteOption[]): Set<string> {
  const emParesAmbiguos = new Set<string>()

  for (const cliente of clientes) {
    const palavras = palavrasSignificativasNomeEmpresa(cliente.nome_empresa)
    for (const palavra of palavras) {
      const candidatos = candidatosPorNomeEmpresa(palavra, clientes)
      if (candidatos.length > 1) {
        for (const id of candidatos) emParesAmbiguos.add(id)
      }
    }
  }

  return emParesAmbiguos
}

export type SugestaoApelido = {
  clienteId: string
  nomeEmpresa: string
  frase: string
  frequencia: number
  totalArquivos: number
  exemplos: string[]
  conflita: boolean
  conflitaCom: { id: string; nome: string }[]
}

type DocumentoHistorico = { cliente_id: string; nome_arquivo: string }

// Analisa o histórico real de uploads (documentos_clientes.nome_arquivo)
// dos clientes envolvidos em pares ambíguos, procurando frases que se
// repetem entre arquivos DIFERENTES — sinal de que é assim que o arquivo
// desse cliente costuma vir nomeado de verdade, não um palpite genérico.
// Não aplica nada sozinho: só monta a lista pra alguém revisar, editar e
// aprovar numa tela.
export function gerarSugestoesApelidos(clientes: ClienteOption[], documentos: DocumentoHistorico[]): SugestaoApelido[] {
  const clientesEmRisco = identificarClientesEmParesAmbiguos(clientes)
  const sugestoes: SugestaoApelido[] = []

  for (const cliente of clientes) {
    if (!clientesEmRisco.has(cliente.id)) continue

    const documentosDoCliente = documentos.filter((documento) => documento.cliente_id === cliente.id)
    if (documentosDoCliente.length === 0) continue

    // Conta em quantos ARQUIVOS DISTINTOS cada frase aparece (Set por
    // arquivo) — não quantas vezes no total, pra um nome de arquivo só,
    // repetindo a mesma frase, não inflar a contagem sozinho.
    const contagemPorFrase = new Map<string, { frequencia: number; exemplos: string[] }>()

    for (const documento of documentosDoCliente) {
      const frasesDoArquivo = new Set(extrairFrasesCandidatas(documento.nome_arquivo))
      for (const frase of frasesDoArquivo) {
        // Já reconhecido pelo apelido/apelidos_extra atual desse cliente —
        // não faz sentido sugerir de novo o que já funciona.
        if (candidatosPorApelido(frase, [cliente]).length > 0) continue

        const atual = contagemPorFrase.get(frase) ?? { frequencia: 0, exemplos: [] }
        atual.frequencia += 1
        if (atual.exemplos.length < 3) atual.exemplos.push(documento.nome_arquivo)
        contagemPorFrase.set(frase, atual)
      }
    }

    for (const [frase, { frequencia, exemplos }] of contagemPorFrase) {
      // "Recorrente" — precisa aparecer em pelo menos 2 arquivos
      // diferentes; exceção só quando o cliente tem 1 documento só no
      // histórico (nesse caso 1 já é "sempre", não dá pra pedir mais).
      const minimoNecessario = documentosDoCliente.length === 1 ? 1 : 2
      if (frequencia < minimoNecessario) continue

      const { conflita, comClientes } = avaliarConflitoApelidoExtra(frase, cliente.id, clientes)

      sugestoes.push({
        clienteId: cliente.id,
        nomeEmpresa: cliente.nome_empresa,
        frase,
        frequencia,
        totalArquivos: documentosDoCliente.length,
        exemplos,
        conflita,
        conflitaCom: comClientes,
      })
    }
  }

  // Sem conflito primeiro (prontas pra aprovar), depois mais frequente e
  // mais específica (mais palavras) — a ordem que mais ajuda quem for
  // revisar de cima pra baixo.
  sugestoes.sort((a, b) => {
    if (a.conflita !== b.conflita) return a.conflita ? 1 : -1
    if (b.frequencia !== a.frequencia) return b.frequencia - a.frequencia
    return b.frase.split(' ').length - a.frase.split(' ').length
  })

  return sugestoes
}

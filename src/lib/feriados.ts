// Todas as datas aqui são tratadas em UTC (via Date.UTC / getUTCFullYear
// etc.) — mesma convenção usada no resto do projeto pra evitar bug de fuso
// horário (uma data local perto da meia-noite não pode "vazar" pro dia
// errado). Quem chama estas funções deve sempre construir/ler datas via UTC.

const FERIADOS_FIXOS: [mes: number, dia: number][] = [
  [1, 1], // Confraternização Universal
  [4, 21], // Tiradentes
  [5, 1], // Dia do Trabalho
  [9, 7], // Independência
  [10, 12], // Nossa Senhora Aparecida
  [11, 2], // Finados
  [11, 15], // Proclamação da República
  [12, 25], // Natal
]

function somarDiasUTC(data: Date, dias: number): Date {
  const resultado = new Date(data)
  resultado.setUTCDate(resultado.getUTCDate() + dias)
  return resultado
}

// Algoritmo de Gauss (forma anônima gregoriana) pra data da Páscoa de
// qualquer ano — a partir dela derivamos os feriados móveis.
function calcularPascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1

  return new Date(Date.UTC(ano, mes - 1, dia))
}

// Carnaval = Páscoa - 47 dias (só a terça-feira, conforme especificado — a
// segunda-feira de Carnaval não entra aqui). Sexta-feira Santa = Páscoa - 2.
// Corpus Christi = Páscoa + 60.
function feriadosMoveisDoAno(ano: number): Date[] {
  const pascoa = calcularPascoa(ano)
  return [somarDiasUTC(pascoa, -47), somarDiasUTC(pascoa, -2), somarDiasUTC(pascoa, 60)]
}

export function ehFeriadoNacional(data: Date): boolean {
  const mes = data.getUTCMonth() + 1
  const dia = data.getUTCDate()

  if (FERIADOS_FIXOS.some(([m, d]) => m === mes && d === dia)) {
    return true
  }

  return feriadosMoveisDoAno(data.getUTCFullYear()).some(
    (feriado) => feriado.getUTCMonth() === data.getUTCMonth() && feriado.getUTCDate() === data.getUTCDate()
  )
}

// Diz se a data é dia útil (não é sábado, domingo nem feriado nacional) —
// não antecipa nem avança nada, só responde a pergunta pra quem precisar
// decidir algo em cima disso (ex: se uma data-base fixa precisa de aviso
// extra por ter caído num dia não útil).
export function ehDiaUtil(data: Date): boolean {
  const diaSemana = data.getUTCDay()
  return diaSemana !== 0 && diaSemana !== 6 && !ehFeriadoNacional(data)
}

// Avança a data enquanto for sábado, domingo ou feriado nacional. Se a data
// de entrada já for dia útil, devolve ela mesma (sem avançar).
export function proximoDiaUtil(data: Date): Date {
  let resultado = new Date(data)

  while (!ehDiaUtil(resultado)) {
    resultado = somarDiasUTC(resultado, 1)
  }

  return resultado
}

// N-ésimo dia útil do mês (ex: 10º dia útil) — conta a partir do dia 1,
// pulando sábados, domingos e feriados.
export function diaUtilDoMes(ano: number, mes: number, n: number): Date {
  let contador = 0
  let data = new Date(Date.UTC(ano, mes - 1, 1))

  while (true) {
    if (ehDiaUtil(data)) {
      contador += 1
      if (contador === n) return data
    }
    data = somarDiasUTC(data, 1)
  }
}

// Último dia útil do mês — parte do último dia do calendário e recua
// enquanto não for dia útil.
export function ultimoDiaUtilDoMes(ano: number, mes: number): Date {
  // dia 0 do mês seguinte, em JS, é o último dia do mês pedido.
  let data = new Date(Date.UTC(ano, mes, 0))

  while (!ehDiaUtil(data)) {
    data = somarDiasUTC(data, -1)
  }

  return data
}

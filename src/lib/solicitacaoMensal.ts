import { ehFeriadoNacional, proximoDiaUtil } from '@/lib/feriados'

// Datas-base do envio mensal são sempre os dias 01 (principal) e 05
// (reforço) do calendário — diferente da lógica de vencimento das
// obrigações acessórias (que usa proximoDiaUtil pra ANTECIPAR a data), aqui
// a data-base nunca é adiada: o envio acontece nela mesmo caindo em fim de
// semana/feriado. Quando isso acontece, além do envio normal nessa data,
// um aviso extra é disparado no primeiro dia útil seguinte.
export type TipoEnvioSolicitacaoMensal = 'principal' | 'reforco' | 'aviso_extra_principal' | 'aviso_extra_reforco'

// Rótulo de exibição pra cada tipo — usado no Portal (lista de solicitações
// do cliente) e no admin (banner de visualizações, página de controle).
export const TIPO_ENVIO_LABEL: Record<TipoEnvioSolicitacaoMensal, string> = {
  principal: 'Solicitação do mês',
  reforco: 'Reforço',
  aviso_extra_principal: 'Aviso extra (dia 01 não foi dia útil)',
  aviso_extra_reforco: 'Aviso extra (dia 05 não foi dia útil)',
}

function ehDiaUtil(data: Date): boolean {
  const diaSemana = data.getUTCDay()
  return diaSemana !== 0 && diaSemana !== 6 && !ehFeriadoNacional(data)
}

function mesmaDataUTC(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

// Roda uma vez por dia (cron diário) e diz quais envios cabem hoje. Pode
// devolver mais de um tipo no mesmo dia — ex: se o dia 01 cai numa
// sexta-feira que é feriado, o próximo dia útil pode coincidir com o dia
// 05, e nesse caso 'reforco' e 'aviso_extra_principal' saem no mesmo dia,
// como dois e-mails separados.
export function determinarEnviosDoDia(hoje: Date): TipoEnvioSolicitacaoMensal[] {
  const ano = hoje.getUTCFullYear()
  const mes = hoje.getUTCMonth() + 1

  const diaPrincipal = new Date(Date.UTC(ano, mes - 1, 1))
  const diaReforco = new Date(Date.UTC(ano, mes - 1, 5))

  const envios: TipoEnvioSolicitacaoMensal[] = []

  if (mesmaDataUTC(hoje, diaPrincipal)) envios.push('principal')
  if (mesmaDataUTC(hoje, diaReforco)) envios.push('reforco')

  if (!ehDiaUtil(diaPrincipal) && mesmaDataUTC(hoje, proximoDiaUtil(diaPrincipal))) {
    envios.push('aviso_extra_principal')
  }
  if (!ehDiaUtil(diaReforco) && mesmaDataUTC(hoje, proximoDiaUtil(diaReforco))) {
    envios.push('aviso_extra_reforco')
  }

  return envios
}

// Chave de competência (YYYY-MM) usada pra dedupe em envios_solicitacao_mensal.
export function competenciaDoMes(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`
}

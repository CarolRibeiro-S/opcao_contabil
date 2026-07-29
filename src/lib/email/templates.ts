type EmailAlertaPrazoParams = {
  nomeCliente: string
  nomeObrigacao: string
  dataVencimento: string
  diasRestantes: number
}

export function emailAlertaPrazo({
  nomeCliente,
  nomeObrigacao,
  dataVencimento,
  diasRestantes,
}: EmailAlertaPrazoParams) {
  const [ano, mes, dia] = dataVencimento.split('-')
  const dataFormatada = `${dia}/${mes}/${ano}`
  const plural = diasRestantes === 1 ? 'dia' : 'dias'

  const subject = `Atenção: ${nomeObrigacao} vence em ${diasRestantes} ${plural}`

  const html = `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0; padding:0; background-color:#f7f8f5; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f8f5; padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #d8ddd0; overflow:hidden;">
            <tr>
              <td style="background-color:#16234a; padding:20px 28px;">
                <span style="color:#8dc63f; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; font-family: 'Courier New', monospace;">
                  Opção Contábil
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Olá, <strong>${nomeCliente}</strong>,
                </p>
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  A obrigação <strong style="color:#16234a;">${nomeObrigacao}</strong> vence em
                  <strong style="color:#8dc63f;">${diasRestantes} ${plural}</strong>, no dia
                  <strong>${dataFormatada}</strong>.
                </p>
                <p style="margin:0 0 24px; color:#24261f; font-size:15px; line-height:1.5;">
                  Fique atento para não perder o prazo. Se precisar de qualquer informação, é só nos chamar.
                </p>
                <p style="margin:0; color:#55564a; font-size:13px;">
                  — Opção Contábil
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim()

  return { subject, html }
}

type EmailAlertaTarefaParams = {
  titulo: string
  nomeCliente: string
  dataLimite: string
  diasRestantes: number
}

export function emailAlertaTarefa({ titulo, nomeCliente, dataLimite, diasRestantes }: EmailAlertaTarefaParams) {
  const [ano, mes, dia] = dataLimite.split('-')
  const dataFormatada = `${dia}/${mes}/${ano}`
  const plural = diasRestantes === 1 ? 'dia' : 'dias'

  const subject = `Tarefa pendente: ${titulo} — vence em ${diasRestantes} ${plural}`

  const html = `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0; padding:0; background-color:#f7f8f5; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f8f5; padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #d8ddd0; overflow:hidden;">
            <tr>
              <td style="background-color:#16234a; padding:20px 28px;">
                <span style="color:#8dc63f; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; font-family: 'Courier New', monospace;">
                  Opção Contábil
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Tarefa com prazo próximo.
                </p>
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  A tarefa <strong style="color:#16234a;">${titulo}</strong> (cliente
                  <strong>${nomeCliente}</strong>) vence em
                  <strong style="color:#8dc63f;">${diasRestantes} ${plural}</strong>, no dia
                  <strong>${dataFormatada}</strong>.
                </p>
                <p style="margin:0; color:#55564a; font-size:13px;">
                  — Opção Contábil
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim()

  return { subject, html }
}

type ItemImposto = {
  tipo: string
  dataVencimento: string
}

type EmailImpostosMensalParams = {
  nomeCliente: string
  competencia: string
  itens: ItemImposto[]
}

export function emailImpostosMensal({ nomeCliente, competencia, itens }: EmailImpostosMensalParams) {
  const [ano, mes] = competencia.split('-')
  const competenciaFormatada = `${mes}/${ano}`

  const subject = `Impostos de ${competenciaFormatada} — Opção Contábil`

  const linhasItens = itens
    .map((item) => {
      const [anoV, mesV, diaV] = item.dataVencimento.split('-')
      const dataFormatada = `${diaV}/${mesV}/${anoV}`

      return `
                  <li style="margin:0 0 8px; color:#24261f; font-size:14px; line-height:1.5;">
                    <strong style="color:#16234a;">${item.tipo}</strong> - VENCIMENTO
                    <strong style="color:#8dc63f;">${dataFormatada}</strong>
                  </li>`
    })
    .join('')

  const html = `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0; padding:0; background-color:#f7f8f5; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f8f5; padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #d8ddd0; overflow:hidden;">
            <tr>
              <td style="background-color:#16234a; padding:20px 28px;">
                <span style="color:#8dc63f; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; font-family: 'Courier New', monospace;">
                  Opção Contábil
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Olá, <strong>${nomeCliente}</strong>,
                </p>
                <ul style="margin:0 0 20px; padding-left:18px;">
                  ${linhasItens}
                </ul>
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Segue os impostos referente ao mês ${competenciaFormatada}.
                </p>
                <p style="margin:0; color:#55564a; font-size:13px;">
                  — Opção Contábil
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim()

  return { subject, html }
}

type ItemResumo = {
  nomeCliente: string
  nomeObrigacao: string
}

type ItemTarefaResumo = {
  titulo: string
  nomeCliente: string
  dataLimite: string
}

type EmailResumoDiarioAdminParams = {
  novosEmAtencao: ItemResumo[]
  vencidosHoje: ItemResumo[]
  tarefasProximas: ItemTarefaResumo[]
}

function listaItensResumo(itens: ItemResumo[], corDestaque: string) {
  if (itens.length === 0) {
    return `<p style="margin:0; color:#8a8f80; font-size:14px;">Nenhum item.</p>`
  }

  const linhas = itens
    .map(
      (item) => `
              <li style="margin:0 0 8px; color:#24261f; font-size:14px; line-height:1.5;">
                <strong style="color:${corDestaque};">${item.nomeObrigacao}</strong> — ${item.nomeCliente}
              </li>`
    )
    .join('')

  return `<ul style="margin:0; padding-left:18px;">${linhas}</ul>`
}

function listaTarefasResumo(tarefas: ItemTarefaResumo[]) {
  if (tarefas.length === 0) {
    return `<p style="margin:0; color:#8a8f80; font-size:14px;">Nenhuma.</p>`
  }

  const linhas = tarefas
    .map((tarefa) => {
      const [ano, mes, dia] = tarefa.dataLimite.split('-')
      const dataFormatada = `${dia}/${mes}/${ano}`

      return `
              <li style="margin:0 0 8px; color:#24261f; font-size:14px; line-height:1.5;">
                <strong style="color:#16234a;">${tarefa.titulo}</strong> — ${tarefa.nomeCliente}
                <span style="color:#8a8f80;">(vence em ${dataFormatada})</span>
              </li>`
    })
    .join('')

  return `<ul style="margin:0; padding-left:18px;">${linhas}</ul>`
}

export function emailResumoDiarioAdmin({
  novosEmAtencao,
  vencidosHoje,
  tarefasProximas,
}: EmailResumoDiarioAdminParams) {
  const subject = 'Resumo diário de prazos — Opção Contábil'

  const semPendencias =
    novosEmAtencao.length === 0 && vencidosHoje.length === 0 && tarefasProximas.length === 0

  const corpo = semPendencias
    ? `
                <p style="margin:0; color:#55564a; font-size:15px; line-height:1.5;">
                  Nenhuma pendência nova hoje.
                </p>`
    : `
                <div style="margin:0 0 24px;">
                  <p style="margin:0 0 10px; color:#16234a; font-size:13px; font-weight:bold; text-transform:uppercase; letter-spacing:0.06em;">
                    Entraram em atenção hoje
                  </p>
                  ${listaItensResumo(novosEmAtencao, '#8dc63f')}
                </div>
                <div style="margin:0 0 24px;">
                  <p style="margin:0 0 10px; color:#16234a; font-size:13px; font-weight:bold; text-transform:uppercase; letter-spacing:0.06em;">
                    Venceram hoje
                  </p>
                  ${listaItensResumo(vencidosHoje, '#b91c1c')}
                </div>
                <div>
                  <p style="margin:0 0 10px; color:#16234a; font-size:13px; font-weight:bold; text-transform:uppercase; letter-spacing:0.06em;">
                    Tarefas com prazo próximo
                  </p>
                  ${listaTarefasResumo(tarefasProximas)}
                </div>`

  const html = `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0; padding:0; background-color:#f7f8f5; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f8f5; padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #d8ddd0; overflow:hidden;">
            <tr>
              <td style="background-color:#16234a; padding:20px 28px;">
                <span style="color:#8dc63f; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; font-family: 'Courier New', monospace;">
                  Opção Contábil
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 20px; color:#24261f; font-size:15px; line-height:1.5;">
                  Resumo diário de prazos.
                </p>
                ${corpo}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim()

  return { subject, html }
}

// Mensagem composta livremente pelo admin (textarea) — escapa antes de
// interpolar no HTML pra não deixar "<"/"&" quebrarem o layout do e-mail.
function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type EmailCodigoAcessoParams = {
  nomeDestinatario: string
  codigo: string
  linkVerificarCodigo: string
}

// Bloco central compartilhado pelos 3 e-mails de acesso abaixo: mostra o
// código OTP em destaque (não um botão que já autentica sozinho). Isso é de
// propósito — o Gmail/Outlook escaneiam e "visitam" automaticamente links
// clicáveis de e-mail por segurança, o que consumia o link mágico de uso
// único antes mesmo do destinatário clicar. O link pra /verificar-codigo é
// seguro de escanear porque sozinho ele não autentica nada — só abre uma
// página com um formulário; quem autentica é o código digitado manualmente.
function blocoCodigoAcesso(codigo: string, linkVerificarCodigo: string) {
  return `
                <p style="margin:0 0 20px; color:#24261f; font-size:15px; line-height:1.5;">
                  Acesse a página abaixo e digite o código para continuar:
                </p>
                <p style="margin:0 0 20px; text-align:center;">
                  <a
                    href="${linkVerificarCodigo}"
                    style="display:inline-block; background-color:#8dc63f; color:#16234a; font-weight:bold; font-size:14px; padding:12px 24px; border-radius:6px; text-decoration:none;"
                  >
                    Digitar código de acesso
                  </a>
                </p>
                <p style="margin:0 0 6px; color:#55564a; font-size:12px; text-align:center; text-transform:uppercase; letter-spacing:0.08em;">
                  Seu código
                </p>
                <p style="margin:0 0 24px; text-align:center; font-family:'Courier New', monospace; font-size:32px; font-weight:bold; letter-spacing:0.25em; color:#16234a;">
                  ${codigo}
                </p>
                <p style="margin:0 0 16px; color:#55564a; font-size:13px; line-height:1.5;">
                  O código expira em algumas horas. Se não conseguir usá-lo a tempo, peça um novo convite ao
                  administrador.
                </p>`
}

function envelopeEmailPadrao(corpo: string) {
  return `
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
}

// Primeiro convite de um cliente pro Portal — substitui o antigo fluxo que
// dependia do e-mail automático do inviteUserByEmail() (não dava pra
// customizar nem mostrar o código nele).
export function emailConvitePortalCliente({ nomeDestinatario, codigo, linkVerificarCodigo }: EmailCodigoAcessoParams) {
  const subject = 'Seu acesso ao Portal do Cliente — Opção Contábil'

  const corpo = `
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Olá, <strong>${escapeHtml(nomeDestinatario)}</strong>,
                </p>
                <p style="margin:0 0 20px; color:#24261f; font-size:15px; line-height:1.5;">
                  Você foi convidado(a) a acessar o <strong style="color:#16234a;">Portal do Cliente</strong> da
                  Opção Contábil, onde você acompanha prazos, honorários, documentos e comunicados.
                </p>
                ${blocoCodigoAcesso(codigo, linkVerificarCodigo)}
                <p style="margin:0; color:#55564a; font-size:13px;">
                  — Opção Contábil
                </p>`

  return { subject, html: envelopeEmailPadrao(corpo) }
}

// Reenvio pra cliente que já tem conta (profile_id já vinculado) — usado
// quando o link/código original expirou antes de ser usado.
export function emailReenvioConvite({ nomeDestinatario, codigo, linkVerificarCodigo }: EmailCodigoAcessoParams) {
  const subject = 'Novo código de acesso — Portal do Cliente'

  const corpo = `
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Olá, <strong>${escapeHtml(nomeDestinatario)}</strong>,
                </p>
                <p style="margin:0 0 20px; color:#24261f; font-size:15px; line-height:1.5;">
                  Aqui está um novo código de acesso ao <strong style="color:#16234a;">Portal do Cliente</strong>.
                </p>
                ${blocoCodigoAcesso(codigo, linkVerificarCodigo)}
                <p style="margin:0 0 16px; color:#55564a; font-size:13px; line-height:1.5;">
                  Se você não pediu esse código, pode ignorar este e-mail com segurança.
                </p>
                <p style="margin:0; color:#55564a; font-size:13px;">
                  — Opção Contábil
                </p>`

  return { subject, html: envelopeEmailPadrao(corpo) }
}

// Convite de um membro da equipe pro Painel Administrativo.
export function emailConviteEquipe({ nomeDestinatario, codigo, linkVerificarCodigo }: EmailCodigoAcessoParams) {
  const subject = 'Seu acesso ao Painel Administrativo — Opção Contábil'

  const corpo = `
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Olá, <strong>${escapeHtml(nomeDestinatario)}</strong>,
                </p>
                <p style="margin:0 0 20px; color:#24261f; font-size:15px; line-height:1.5;">
                  Você foi convidado(a) a acessar o <strong style="color:#16234a;">Painel Administrativo</strong>
                  da Opção Contábil.
                </p>
                ${blocoCodigoAcesso(codigo, linkVerificarCodigo)}
                <p style="margin:0; color:#55564a; font-size:13px;">
                  — Opção Contábil
                </p>`

  return { subject, html: envelopeEmailPadrao(corpo) }
}

type EmailComunicadoParams = {
  nomeCliente: string
  titulo: string
  mensagem: string
  tipo: 'aviso' | 'solicitacao_documento'
}

export function emailComunicado({ nomeCliente, titulo, mensagem, tipo }: EmailComunicadoParams) {
  const subject = titulo

  const mensagemHtml = escapeHtml(mensagem).replace(/\n/g, '<br />')

  const avisoPortal =
    tipo === 'solicitacao_documento'
      ? `
                <p style="margin:0 0 20px; padding:12px 16px; background-color:#f7f8f5; border-radius:6px; color:#24261f; font-size:13.5px; line-height:1.5;">
                  Você pode responder anexando o documento direto no <strong style="color:#16234a;">Portal do Cliente</strong>, em <strong>Comunicados</strong>.
                </p>`
      : ''

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
                  Olá, <strong>${escapeHtml(nomeCliente)}</strong>,
                </p>
                <p style="margin:0 0 14px; color:#16234a; font-size:17px; font-weight:bold; line-height:1.4;">
                  ${escapeHtml(titulo)}
                </p>
                <p style="margin:0 0 20px; color:#24261f; font-size:15px; line-height:1.6;">
                  ${mensagemHtml}
                </p>
                ${avisoPortal}
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

type EmailNovaMensagemComunicadoParams = {
  nomeDestinatario: string
  autorNome: string
  tituloComunicado: string
  mensagem: string
  link: string
}

// Aviso de nova mensagem numa conversa de comunicado já existente (thread) —
// disparado tanto quando o admin responde (destinatário: cliente) quanto
// quando o cliente responde (destinatário: quem criou o comunicado).
export function emailNovaMensagemComunicado({
  nomeDestinatario,
  autorNome,
  tituloComunicado,
  mensagem,
  link,
}: EmailNovaMensagemComunicadoParams) {
  const subject = `Nova mensagem em "${tituloComunicado}" — Opção Contábil`

  const mensagemHtml = mensagem ? escapeHtml(mensagem).replace(/\n/g, '<br />') : '<em>(enviou um anexo)</em>'

  const corpo = `
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Olá, <strong>${escapeHtml(nomeDestinatario)}</strong>,
                </p>
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  <strong style="color:#16234a;">${escapeHtml(autorNome)}</strong> respondeu na conversa
                  <strong>${escapeHtml(tituloComunicado)}</strong>:
                </p>
                <p style="margin:0 0 20px; padding:12px 16px; background-color:#f7f8f5; border-radius:6px; color:#24261f; font-size:14px; line-height:1.6;">
                  ${mensagemHtml}
                </p>
                <p style="margin:0 0 20px; text-align:center;">
                  <a
                    href="${link}"
                    style="display:inline-block; background-color:#8dc63f; color:#16234a; font-weight:bold; font-size:14px; padding:12px 24px; border-radius:6px; text-decoration:none;"
                  >
                    Ver conversa
                  </a>
                </p>
                <p style="margin:0; color:#55564a; font-size:13px;">
                  — Opção Contábil
                </p>`

  return { subject, html: envelopeEmailPadrao(corpo) }
}

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

// Mesmo alerta de emailAlertaPrazo, mas pra janela mais antecipada (10 dias)
// — tom deliberadamente menos urgente ("Fique de olho" em vez de "Atenção"),
// já que ainda não é hora de soar alarme, só de dar um aviso antecedido.
export function emailAlertaPrazoAntecipado({
  nomeCliente,
  nomeObrigacao,
  dataVencimento,
  diasRestantes,
}: EmailAlertaPrazoParams) {
  const [ano, mes, dia] = dataVencimento.split('-')
  const dataFormatada = `${dia}/${mes}/${ano}`
  const plural = diasRestantes === 1 ? 'dia' : 'dias'

  const subject = `Lembrete: ${nomeObrigacao} vence em ${diasRestantes} ${plural}`

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
                  Fique de olho: a obrigação <strong style="color:#16234a;">${nomeObrigacao}</strong> vence em
                  <strong style="color:#8dc63f;">${diasRestantes} ${plural}</strong>, no dia
                  <strong>${dataFormatada}</strong>.
                </p>
                <p style="margin:0 0 24px; color:#24261f; font-size:15px; line-height:1.5;">
                  Ainda dá tempo de se organizar com calma. Se precisar de qualquer informação, é só nos chamar.
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
  lembretes10Dias: ItemResumo[]
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
  lembretes10Dias,
  tarefasProximas,
}: EmailResumoDiarioAdminParams) {
  const subject = 'Resumo diário de prazos — Opção Contábil'

  const semPendencias =
    novosEmAtencao.length === 0 &&
    vencidosHoje.length === 0 &&
    lembretes10Dias.length === 0 &&
    tarefasProximas.length === 0

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
                <div style="margin:0 0 24px;">
                  <p style="margin:0 0 10px; color:#16234a; font-size:13px; font-weight:bold; text-transform:uppercase; letter-spacing:0.06em;">
                    Lembretes de 10 dias (ainda não estão em atenção)
                  </p>
                  ${listaItensResumo(lembretes10Dias, '#3b82f6')}
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

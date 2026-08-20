import type { TipoEnvioSolicitacaoMensal } from '@/lib/solicitacaoMensal'

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
  // Nome do destinatário no assunto — sem isso, dois convites (ex: duas
  // empresas do mesmo dono, mesmo e-mail de contato) ficam com assunto
  // idêntico e o Gmail agrupa como uma única conversa, escondendo um dos
  // dois convites (mesma causa raiz do bug de "só recebi um dos e-mails"
  // investigado no Envio Mensal).
  const subject = `Seu acesso ao Portal do Cliente — ${nomeDestinatario} — Opção Contábil`

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
  const subject = `Novo código de acesso — ${nomeDestinatario} — Portal do Cliente`

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

type EmailEmpresaVinculadaParams = {
  nomeDestinatario: string
  nomeEmpresa: string
}

// Disparado quando uma empresa nova é vinculada a uma conta que JÁ existe
// (mesmo dono, mesmo e-mail, mais de uma empresa — ver
// api/clientes/convidar/route.ts). Diferente do convite normal, aqui não
// tem código nenhum: a pessoa já tem senha, só ganhou acesso a mais uma
// empresa no mesmo login.
export function emailEmpresaVinculada({ nomeDestinatario, nomeEmpresa }: EmailEmpresaVinculadaParams) {
  const subject = `Nova empresa vinculada ao seu acesso — ${nomeEmpresa} — Opção Contábil`

  const corpo = `
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Olá, <strong>${escapeHtml(nomeDestinatario)}</strong>,
                </p>
                <p style="margin:0 0 20px; color:#24261f; font-size:15px; line-height:1.5;">
                  A empresa <strong style="color:#16234a;">${escapeHtml(nomeEmpresa)}</strong> foi vinculada
                  ao seu acesso do <strong style="color:#16234a;">Portal do Cliente</strong>. Use o mesmo
                  login de sempre — agora dá pra alternar entre suas empresas direto pelo menu lateral do
                  Portal, sem precisar de um código novo.
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
  // Nome do cliente no assunto: enviar-massa (comunicado em lote) manda o
  // MESMO título pra vários clientes de uma vez — se dois deles
  // compartilharem e-mail de contato (ex: mesmo dono, empresas
  // diferentes), o Gmail agrupa os dois na mesma conversa e um passa
  // despercebido. Mesma causa raiz do bug investigado no Envio Mensal.
  const subject = `${titulo} — ${nomeCliente}`

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
  const subject = `Nova mensagem em "${tituloComunicado}" — ${nomeDestinatario} — Opção Contábil`

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

// Alerta INTERNO (só o escritório recebe, ver cron/prazos) — obrigação
// acessória é responsabilidade exclusiva da Opção Contábil, então o texto
// se dirige à equipe, não ao cliente (nome do cliente aparece só como
// referência, entre parênteses, igual ao padrão já usado em
// emailAlertaTarefa).
export function emailAlertaPrazo({
  nomeCliente,
  nomeObrigacao,
  dataVencimento,
  diasRestantes,
}: EmailAlertaPrazoParams) {
  const [ano, mes, dia] = dataVencimento.split('-')
  const dataFormatada = `${dia}/${mes}/${ano}`
  const plural = diasRestantes === 1 ? 'dia' : 'dias'

  // Nome do cliente no assunto — esses alertas vão TODOS pro mesmo endereço
  // (ADMIN_ALERT_EMAIL, ver cron/prazos), então dois clientes diferentes
  // com a mesma obrigação vencendo no mesmo prazo (ex: "DAS vence em 5
  // dias") geram assunto idêntico e o Gmail agrupa como uma única
  // conversa — mesma causa raiz do bug investigado no Envio Mensal.
  const subject = `Atenção: ${nomeObrigacao} vence em ${diasRestantes} ${plural} — ${nomeCliente}`

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
                  Prazo de cliente com vencimento próximo.
                </p>
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  A obrigação <strong style="color:#16234a;">${nomeObrigacao}</strong> (cliente
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

// Mesmo alerta de emailAlertaPrazo, mas pra janela mais antecipada (10 dias)
// — tom deliberadamente menos urgente ("Fique de olho" em vez de "Atenção"),
// já que ainda não é hora de soar alarme, só de dar um aviso antecedido.
//
// Assim como emailAlertaPrazo, esse é um alerta INTERNO (só o escritório
// recebe — obrigação acessória é responsabilidade exclusiva da Opção
// Contábil, o cliente não deve ser notificado disso, só confundia). Por
// isso o texto não se dirige ao cliente ("Olá, X") nem promete retorno
// ("é só nos chamar") — é um aviso operacional pra equipe.
export function emailAlertaPrazoAntecipado({
  nomeCliente,
  nomeObrigacao,
  dataVencimento,
  diasRestantes,
}: EmailAlertaPrazoParams) {
  const [ano, mes, dia] = dataVencimento.split('-')
  const dataFormatada = `${dia}/${mes}/${ano}`
  const plural = diasRestantes === 1 ? 'dia' : 'dias'

  const subject = `Lembrete: ${nomeObrigacao} vence em ${diasRestantes} ${plural} — ${nomeCliente}`

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
                  Prazo de cliente vencendo em breve — ainda não é urgente.
                </p>
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Fique de olho: a obrigação <strong style="color:#16234a;">${nomeObrigacao}</strong> (cliente
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

  const subject = `Tarefa pendente: ${titulo} — vence em ${diasRestantes} ${plural} — ${nomeCliente}`

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
  itensInformativos?: string[]
}

// Frase usada tanto na prévia da Etapa 3 quanto no e-mail de verdade pra
// documentos informativos (sem vencimento), como o extrato do Simples
// Nacional.
export function mensagemInformativa(tipo: string) {
  if (tipo === 'Extrato do Simples Nacional') return 'Segue seu extrato do Simples Nacional.'
  if (tipo === 'Documentos da Empresa') return 'Seguem documentos da empresa.'
  return `Segue o(a) ${tipo}.`
}

export function emailImpostosMensal({
  nomeCliente,
  competencia,
  itens,
  itensInformativos = [],
}: EmailImpostosMensalParams) {
  const [ano, mes] = competencia.split('-')
  const competenciaFormatada = `${mes}/${ano}`

  // Nome do cliente no assunto — a causa raiz do bug reportado: 4 clientes
  // diferentes (mesmo dono, mesmo e-mail de contato) recebendo "Impostos
  // de 07/2026 — Opção Contábil" com assunto IDÊNTICO faziam o Gmail
  // agrupar tudo numa única conversa, e o destinatário só via o e-mail
  // mais recente do grupo — os outros pareciam "não entregues", mas a
  // Resend confirmou entrega dos 3 (checado no painel).
  const subject = `Impostos de ${competenciaFormatada} — ${nomeCliente} — Opção Contábil`

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

  const blocoVencimentos =
    itens.length > 0
      ? `
                <ul style="margin:0 0 20px; padding-left:18px;">
                  ${linhasItens}
                </ul>
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Segue os impostos referente ao mês ${competenciaFormatada}.
                </p>`
      : ''

  const blocoInformativos = itensInformativos
    .map(
      (tipo) => `
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  ${mensagemInformativa(tipo)}
                </p>`
    )
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
                </p>${blocoVencimentos}${blocoInformativos}
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

// URLs das duas artes (envio de XML e extrato bancário) fornecidas pelo
// escritório — configuradas via env var (hospedar num link público, ex:
// bucket do Supabase Storage) em vez de embutidas no HTML. Ficam de fora
// do e-mail enquanto a env var não existir, sem quebrar o layout.
const URL_IMAGEM_SOLICITACAO_XML = process.env.IMAGEM_SOLICITACAO_XML_URL
const URL_IMAGEM_SOLICITACAO_EXTRATO = process.env.IMAGEM_SOLICITACAO_EXTRATO_URL

function blocoImagemSolicitacao(url: string | undefined, alt: string) {
  if (!url) return ''

  return `
                <p style="margin:0 0 20px;">
                  <img src="${url}" alt="${alt}" style="max-width:100%; border-radius:6px; display:block;" />
                </p>`
}

type TextosSolicitacaoMensal = {
  titulo: string
  introducao: string
}

function textosPorTipoEnvio(tipo: TipoEnvioSolicitacaoMensal, competenciaFormatada: string): TextosSolicitacaoMensal {
  switch (tipo) {
    case 'principal':
      return {
        titulo: `Solicitação de documentos — ${competenciaFormatada}`,
        introducao: `Chegou a hora de organizarmos a contabilidade referente a ${competenciaFormatada}. Para isso, precisamos que você nos envie:`,
      }
    case 'reforco':
      return {
        titulo: `Lembrete: documentos de ${competenciaFormatada} — Opção Contábil`,
        introducao: `Este é um lembrete: ainda estamos aguardando os documentos referentes a ${competenciaFormatada}. Se você já enviou, pode desconsiderar este e-mail. Precisamos de:`,
      }
    case 'aviso_extra_principal':
      return {
        titulo: `Solicitação de documentos — ${competenciaFormatada}`,
        introducao: `O último dia 01 caiu em um dia não útil, então reforçamos aqui o pedido de documentos referentes a ${competenciaFormatada}:`,
      }
    case 'aviso_extra_reforco':
      return {
        titulo: `Lembrete: documentos de ${competenciaFormatada} — Opção Contábil`,
        introducao: `O último dia 05 caiu em um dia não útil, então reforçamos aqui o lembrete dos documentos referentes a ${competenciaFormatada}. Se você já enviou, pode desconsiderar este e-mail:`,
      }
  }
}

type EmailSolicitacaoMensalParams = {
  nomeCliente: string
  tipo: TipoEnvioSolicitacaoMensal
  competencia: string // 'YYYY-MM'
  emiteNotasFiscais: boolean
  possuiEmpregados: boolean
  linkPortal: string
}

export function emailSolicitacaoMensal({
  nomeCliente,
  tipo,
  competencia,
  emiteNotasFiscais,
  possuiEmpregados,
  linkPortal,
}: EmailSolicitacaoMensalParams) {
  const [ano, mes] = competencia.split('-')
  const competenciaFormatada = `${mes}/${ano}`

  const { titulo, introducao } = textosPorTipoEnvio(tipo, competenciaFormatada)
  const subject = `${titulo} — ${nomeCliente} — Opção Contábil`

  const itensLista = [
    emiteNotasFiscais ? 'XML das notas fiscais emitidas no período' : null,
    'Extrato bancário do período',
    'Relação de receitas e despesas do período',
    possuiEmpregados ? 'Informações de folha de pagamento (faltas, atestados médicos, banco de horas)' : null,
  ].filter((item): item is string => item !== null)

  const listaHtml = itensLista
    .map(
      (item) => `
                  <li style="margin:0 0 8px; color:#24261f; font-size:14px; line-height:1.5;">${item}</li>`
    )
    .join('')

  const blocoImagens = emiteNotasFiscais
    ? `${blocoImagemSolicitacao(URL_IMAGEM_SOLICITACAO_XML, 'Como enviar o XML das notas fiscais')}${blocoImagemSolicitacao(URL_IMAGEM_SOLICITACAO_EXTRATO, 'Como enviar o extrato bancário')}`
    : blocoImagemSolicitacao(URL_IMAGEM_SOLICITACAO_EXTRATO, 'Como enviar o extrato bancário')

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
                  ${introducao}
                </p>
                <ul style="margin:0 0 20px; padding-left:18px;">
                  ${listaHtml}
                </ul>
                ${blocoImagens}
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Você pode responder direto este e-mail (<a href="mailto:opcaocontabilbsb@gmail.com" style="color:#16234a;">opcaocontabilbsb@gmail.com</a>) ou enviar pelo
                  <a href="${linkPortal}" style="color:#16234a;">Portal do Cliente</a> — use o que for mais prático para você.
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

type EmailAlertaFalhaEnvioResendParams = {
  destinatarios: string
  assuntoOriginal: string
  motivo: string
  dataEventoIso: string
}

// Aviso pra Carol (fora do admin, direto no e-mail pessoal) quando o
// webhook da Resend confirma que um envio falhou de verdade — bounce,
// falha de despacho, atraso de entrega ou reclamação de spam. Diferente do
// e-mail de resumo diário acima (esse é operacional pro Hederson, dentro
// do fluxo normal do sistema), este é um alerta pontual de infraestrutura.
export function emailAlertaFalhaEnvioResend({
  destinatarios,
  assuntoOriginal,
  motivo,
  dataEventoIso,
}: EmailAlertaFalhaEnvioResendParams) {
  const dataEvento = new Date(dataEventoIso)
  const dataFormatada = dataEvento.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const horaFormatada = dataEvento.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const subject = `[Alerta] Falha no envio de e-mail — ${destinatarios}`

  const html = `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0; padding:0; background-color:#f7f8f5; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f8f5; padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; border:1px solid #d8ddd0; overflow:hidden;">
            <tr>
              <td style="background-color:#b91c1c; padding:20px 28px;">
                <span style="color:#ffffff; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; font-family: 'Courier New', monospace;">
                  Opção Contábil — Alerta de Entrega
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Um e-mail enviado pelo sistema falhou de verdade na entrega (confirmado pela Resend).
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px; border:1px solid #d8ddd0; border-radius:6px;">
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #eceee7;">
                      <p style="margin:0 0 2px; color:#8a8f80; font-size:11px; text-transform:uppercase; letter-spacing:0.06em;">Destinatário</p>
                      <p style="margin:0; color:#24261f; font-size:14px;">${escapeHtml(destinatarios)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #eceee7;">
                      <p style="margin:0 0 2px; color:#8a8f80; font-size:11px; text-transform:uppercase; letter-spacing:0.06em;">Assunto original</p>
                      <p style="margin:0; color:#24261f; font-size:14px;">${escapeHtml(assuntoOriginal)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #eceee7;">
                      <p style="margin:0 0 2px; color:#8a8f80; font-size:11px; text-transform:uppercase; letter-spacing:0.06em;">Motivo</p>
                      <p style="margin:0; color:#b91c1c; font-size:14px; font-weight:bold;">${escapeHtml(motivo)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0 0 2px; color:#8a8f80; font-size:11px; text-transform:uppercase; letter-spacing:0.06em;">Quando</p>
                      <p style="margin:0; color:#24261f; font-size:14px;">${dataFormatada} às ${horaFormatada}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0; color:#55564a; font-size:13px;">
                  Aviso automático via webhook da Resend.
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

type EmailCobrancaBoletoParams = {
  nomeCliente: string
  competencia: string
  valor: number
  dataVencimento: string
}

// Disparado quando o Hederson anexa o boleto de um honorário pela primeira
// vez (ver EditarCobrancaForm.tsx / api/cobrancas/notificar-boleto) — o
// boleto em si vai como anexo do e-mail, não como link, já que o cliente
// não tem obrigação de acessar o Portal só pra pegar o PDF.
export function emailCobrancaBoleto({ nomeCliente, competencia, valor, dataVencimento }: EmailCobrancaBoletoParams) {
  const [anoComp, mesComp] = competencia.split('-')
  const competenciaFormatada = `${mesComp}/${anoComp}`
  const [anoVenc, mesVenc, diaVenc] = dataVencimento.split('-')
  const dataFormatada = `${diaVenc}/${mesVenc}/${anoVenc}`
  const valorFormatado = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Nome do cliente no assunto — WNF/WNR/WGKS/Calebe (os mesmos 4 clientes
  // do bug de threading no Envio Mensal) também têm honorário mensal
  // automático (ver gerarHonorarios.ts) com o mesmo dono/e-mail — sem o
  // nome aqui, o boleto de um deles reproduziria o mesmo problema.
  const subject = `Boleto do honorário — ${competenciaFormatada} — ${nomeCliente}`

  const corpo = `
                <p style="margin:0 0 16px; color:#24261f; font-size:15px; line-height:1.5;">
                  Olá, <strong>${escapeHtml(nomeCliente)}</strong>,
                </p>
                <p style="margin:0 0 20px; color:#24261f; font-size:15px; line-height:1.5;">
                  Segue em anexo o boleto do seu honorário contábil referente a
                  <strong style="color:#16234a;">${competenciaFormatada}</strong>.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px; border:1px solid #d8ddd0; border-radius:6px;">
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #eceee7;">
                      <p style="margin:0 0 2px; color:#8a8f80; font-size:11px; text-transform:uppercase; letter-spacing:0.06em;">Valor</p>
                      <p style="margin:0; color:#24261f; font-size:14px;">${valorFormatado}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0 0 2px; color:#8a8f80; font-size:11px; text-transform:uppercase; letter-spacing:0.06em;">Vencimento</p>
                      <p style="margin:0; color:#24261f; font-size:14px;">${dataFormatada}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0; color:#55564a; font-size:13px;">
                  — Opção Contábil
                </p>`

  return { subject, html: envelopeEmailPadrao(corpo) }
}

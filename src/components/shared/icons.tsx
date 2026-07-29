type IconProps = { className?: string }

function IconBase({ className, children }: IconProps & { children: React.ReactNode }) {
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
      {children}
    </svg>
  )
}

function IconDashboard({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.3" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.3" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.3" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.3" />
    </IconBase>
  )
}

function IconClientes({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="7.2" cy="7" r="2.6" />
      <path d="M2.4 16c.5-3 2.2-4.6 4.8-4.6s4.3 1.6 4.8 4.6" />
      <circle cx="14.1" cy="6.4" r="2.1" />
      <path d="M12.8 11.5c1.9.2 3.3 1.9 3.8 4.5" />
    </IconBase>
  )
}

function IconEnvioMensal({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="2.2" y="4.6" width="15.6" height="10.8" rx="1.6" />
      <path d="M2.6 5.4l7.4 5.9 7.4-5.9" />
    </IconBase>
  )
}

function IconTarefas({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="10" cy="10" r="7.3" />
      <path d="M6.6 10.2l2.3 2.3 4.5-4.8" />
    </IconBase>
  )
}

function IconPrazos({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="2.5" y="4" width="15" height="13.4" rx="1.6" />
      <path d="M2.5 8.1h15M6.6 2.3v3.2M13.4 2.3v3.2" />
    </IconBase>
  )
}

function IconHonorarios({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="2" y="5.3" width="16" height="9.4" rx="1.6" />
      <circle cx="10" cy="10" r="2.1" />
      <path d="M4.3 7.7h.01M15.7 12.3h.01" />
    </IconBase>
  )
}

function IconFinanceiro({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M3 17V10.5M9.3 17V4.5M15.7 17v-6.5" />
      <path d="M2.3 17h15.4" />
    </IconBase>
  )
}

function IconEquipe({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="7" cy="8" r="3" />
      <path d="M2 16c.6-3.5 2.4-5.3 5-5.3s4.4 1.8 5 5.3" />
      <path d="M14.3 4.5v5M11.8 7h5" />
    </IconBase>
  )
}

function IconInicio({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M3 9.3L10 3.3l7 6" />
      <path d="M4.8 8.3V17h10.4V8.3" />
    </IconBase>
  )
}

function IconComunicados({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M3 4.8a1.4 1.4 0 011.4-1.4h11.2A1.4 1.4 0 0117 4.8V12a1.4 1.4 0 01-1.4 1.4H9l-4 3v-3H4.4A1.4 1.4 0 013 12z" />
    </IconBase>
  )
}

function IconDocumentos({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M6 2.6h5.2l3.8 3.8v10.4a1 1 0 01-1 1H6a1 1 0 01-1-1V3.6a1 1 0 011-1z" />
      <path d="M11.2 2.6v3.8H15" />
      <path d="M6.8 11h6.4M6.8 13.8h6.4" />
    </IconBase>
  )
}

function IconHistorico({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="10" cy="10.5" r="7.3" />
      <path d="M10 6.5v4l2.8 1.9" />
    </IconBase>
  )
}

export function IconChevron({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M7 4.5l6 5.5-6 5.5" />
    </IconBase>
  )
}

export function IconLogout({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M7.8 3.3H4.6a1.3 1.3 0 00-1.3 1.3v10.8a1.3 1.3 0 001.3 1.3h3.2" />
      <path d="M12.5 6.3l3.7 3.7-3.7 3.7" />
      <path d="M16.2 10H7.8" />
    </IconBase>
  )
}

export const ICONES = {
  dashboard: IconDashboard,
  clientes: IconClientes,
  envioMensal: IconEnvioMensal,
  tarefas: IconTarefas,
  prazos: IconPrazos,
  honorarios: IconHonorarios,
  financeiro: IconFinanceiro,
  equipe: IconEquipe,
  inicio: IconInicio,
  comunicados: IconComunicados,
  documentos: IconDocumentos,
  historico: IconHistorico,
} as const

export type IconKey = keyof typeof ICONES

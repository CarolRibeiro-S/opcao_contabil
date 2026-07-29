import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AcoesEquipe from '@/components/admin/AcoesEquipe'

const statusBadge: Record<string, string> = {
  ativo: 'border border-[#c8e2a1] bg-[#eef7e0] text-[#4f8f2a]',
  inativo: 'border border-rule bg-paper-dim text-navy-soft',
}

const statusLabel: Record<string, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
}

export default async function EquipePage() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: membros } = await supabase
    .from('profiles')
    .select('id, nome, email, telefone, cargo, status')
    .eq('role', 'admin')
    .order('nome', { ascending: true })

  const { data: usuariosAuth } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })

  const conviteAceitoPorId = new Map(
    (usuariosAuth?.users ?? []).map((usuario) => [usuario.id, Boolean(usuario.email_confirmed_at)])
  )

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Equipe</h1>
        <Link
          href="/admin/equipe/novo"
          className="inline-flex items-center gap-2 rounded-[3px] bg-lime px-4 py-2 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-lime-bright"
        >
          + Convidar membro
        </Link>
      </div>

      {!membros || membros.length === 0 ? (
        <p className="text-sm text-navy-soft">Nenhum membro cadastrado ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-paper-dim">
                <tr>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Nome
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    E-mail
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Telefone
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Cargo
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Status
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Convite
                  </th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-navy-soft">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {membros.map((membro) => {
                  const aceito = conviteAceitoPorId.get(membro.id) ?? false

                  return (
                    <tr key={membro.id} className="border-t border-rule">
                      <td className="px-4 py-3 font-medium text-navy">{membro.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-charcoal">{membro.email ?? '—'}</td>
                      <td className="px-4 py-3 text-charcoal">{membro.telefone ?? '—'}</td>
                      <td className="px-4 py-3 text-charcoal">{membro.cargo ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                            statusBadge[membro.status] ?? 'border border-rule bg-paper-dim text-navy-soft'
                          }`}
                        >
                          {statusLabel[membro.status] ?? membro.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
                            aceito
                              ? 'border border-[#c8e2a1] bg-[#eef7e0] text-[#4f8f2a]'
                              : 'border border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {aceito ? 'Convite aceito' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AcoesEquipe
                          id={membro.id}
                          status={membro.status}
                          ehUsuarioLogado={membro.id === user?.id}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

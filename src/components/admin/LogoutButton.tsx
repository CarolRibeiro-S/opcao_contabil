'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-[#c4cbe0] transition-colors duration-200 hover:bg-white/5 hover:text-white"
    >
      <span aria-hidden="true">↩</span>
      Sair
    </button>
  )
}

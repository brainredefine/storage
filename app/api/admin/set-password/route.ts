import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin' // service role client

export const runtime = 'nodejs'

export async function POST(req: Request) {
  // 1) Authentifie l’appelant et restreins à ton email admin
  const userClient = createRouteHandlerClient({ cookies })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user || user.email !== 'gauthier@redefine.group') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2) Parse payload
  const { userId, newPassword } = await req.json().catch(() => ({}))
  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'userId and newPassword required' }, { status: 400 })
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json({ error: 'Weak password' }, { status: 400 })
  }

  // 3) Update via Admin API (service role)
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // 4) Option : invalider les autres sessions de cet utilisateur
  // (pas d’API directe pour tout invalider au 1er degré côté GoTrue v2, skip ou gère autrement)

  return NextResponse.json({ ok: true, user: { id: data.user?.id, email: data.user?.email } })
}

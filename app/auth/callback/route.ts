// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')
  const redirectParam = requestUrl.searchParams.get('redirect')

  const supabase = createRouteHandlerClient({ cookies })

  if (code) {
    // Crée la session à partir du code de l’URL
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Où envoyer l’utilisateur après création de session ?
  const nextPath = redirectParam || '/set-password'
  const redirectUrl = new URL(nextPath, requestUrl.origin)

  return NextResponse.redirect(redirectUrl)
}

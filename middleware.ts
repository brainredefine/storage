// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/.well-known')
  )
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const url = req.nextUrl
  const { pathname } = url

  // Autoriser les preflight CORS pour l’API
  if (pathname.startsWith('/api') && req.method === 'OPTIONS') {
    return res
  }

  // Laisser passer les assets publics
  if (isPublicAsset(pathname)) {
    return res
  }

  // Callback Supabase (magic link / invitations / reset, etc.)
  if (pathname === '/auth/callback') {
    return res
  }

  // Page set-password : publique côté middleware (la page re-vérifie la session)
  if (pathname === '/set-password') {
    return res
  }

  // /login est public, mais si déjà loggé → redirection
  if (pathname === '/login') {
    if (session) {
      const redirectTarget = url.searchParams.get('redirect') || '/'
      const u = url.clone()
      u.pathname = redirectTarget
      u.search = ''
      return NextResponse.redirect(u)
    }
    return res
  }

  // ---- Protection globale ----
  if (!session) {
    // Pour les pages → redirect vers /login (avec retour post-auth via ?redirect=…)
    if (!pathname.startsWith('/api')) {
      const u = url.clone()
      u.pathname = '/login'
      const originalPath = pathname + (url.search || '')
      u.searchParams.set('redirect', originalPath)
      return NextResponse.redirect(u)
    }

    // Pour l'API → 401 JSON
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Session OK → continuer
  return res
}

export const config = {
  matcher: ['/:path*', '/api/:path*'],
}

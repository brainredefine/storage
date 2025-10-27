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
  const { data: { session } } = await supabase.auth.getSession()

  const url = req.nextUrl
  const { pathname } = url

  // Autorise preflight CORS pour l'API
  if (pathname.startsWith('/api') && req.method === 'OPTIONS') return res

  // Assets publics
  if (isPublicAsset(pathname)) return res

  // ⛳️ /set-password : public côté middleware
  // (la page vérifiera la session Supabase; sans session => redirect /login)
  if (pathname === '/set-password') {
    return res
  }

  // /login public, mais si déjà loggé → /
  if (pathname === '/login') {
    if (session) {
      const u = url.clone()
      u.pathname = '/'
      u.search = ''
      return NextResponse.redirect(u)
    }
    return res
  }

  // Protection globale (pages & API)
  if (!session) {
    // Pour les pages → redirect vers /login (avec retour post-auth)
    if (!pathname.startsWith('/api')) {
      const u = url.clone()
      u.pathname = '/login'
      u.searchParams.set('redirectTo', pathname + url.search)
      return NextResponse.redirect(u)
    }
    // Pour l'API → 401 JSON
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return res
}

export const config = {
  matcher: ['/:path*', '/api/:path*'],
}

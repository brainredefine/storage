// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Préparer la réponse (nécessaire pour manipuler les cookies)
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Vérifier l'utilisateur (Gère automatiquement le Refresh Token et les erreurs)
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl
  const path = url.pathname

  // 1. IGNORER les fichiers statiques (images, _next, api, etc.)
  if (path.startsWith('/_next') || path.startsWith('/static') || path.startsWith('/api') || path.includes('.')) {
    return response
  }

  // 2. SI NON CONNECTÉ
  if (!user) {
    // Si on n'est pas déjà sur /login, on y va de force
    if (path !== '/login') {
      const u = url.clone()
      u.pathname = '/login'
      // Optionnel : garder la redirection pour après le login
      // u.searchParams.set('redirect', path) 
      return NextResponse.redirect(u)
    }
  }

  // 3. SI CONNECTÉ
  if (user) {
    // Si on essaie d'aller sur /login, on renvoie vers l'accueil
    if (path === '/login') {
      const u = url.clone()
      u.pathname = '/'
      return NextResponse.redirect(u)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
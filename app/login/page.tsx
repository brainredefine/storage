// app/login/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseClient'

/* ---------- UI tokens ---------- */
const TOKENS = {
  radius: 'rounded-2xl',
  border: 'border border-neutral-300 dark:border-neutral-700',
  surface: 'bg-white dark:bg-neutral-900',
  text: 'text-neutral-900 dark:text-neutral-100',
  focus: 'focus:ring-2 focus:ring-neutral-300 focus:outline-none',
} as const
const INPUT = `w-full ${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-2 text-sm ${TOKENS.text} placeholder:text-neutral-400 ${TOKENS.focus}`

export default function Page() {
  const router = useRouter()
  const sp = useSearchParams()
  const redirect = sp.get('redirect') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Si déjà connecté, redirige immédiatement
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabaseBrowser.auth.getSession()
      if (mounted && data.session) {
        router.replace(redirect)
        router.refresh()
      }
    })()
    return () => { mounted = false }
  }, [router, redirect])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.replace(redirect)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Login</h1>

      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Email</span>
          <input
            type="email"
            className={INPUT}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Password</span>
          <input
            type="password"
            className={INPUT}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className={`inline-flex items-center justify-center ${TOKENS.radius} bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900`}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}

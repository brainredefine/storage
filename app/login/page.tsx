'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseClient'

// Empêche le prerender statique qui gueule avec useSearchParams()
export const dynamic = 'force-dynamic'

const INPUT =
  'w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300'

// --- Inner component (utilise useSearchParams) ---
function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get('redirectTo') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // reset password (forgot)
  const [resetMsg, setResetMsg] = useState<string>('')
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => setError(''), [email, password])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password })
      if (error) throw error

      // Redirection 1ʳᵉ connexion si flag user_metadata.must_set_password
      const { data: { user } } = await supabaseBrowser.auth.getUser()
      const mustSet = Boolean(user?.user_metadata?.must_set_password)
      router.replace(mustSet ? '/set-password' : redirectTo)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function onForgotPassword() {
    setResetMsg('')
    if (!email) { setResetMsg('Enter your email first.'); return }
    try {
      setResetLoading(true)
      await supabaseBrowser.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      })
      setResetMsg('Check your inbox for the reset link.')
    } catch {
      setResetMsg('Failed to send reset email.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white dark:bg-white text-neutral-900">
      <div className="mx-auto max-w-md px-6 py-16">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-neutral-600">Authentication required.</p>
        </header>

        <form onSubmit={onSubmit} className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={onForgotPassword}
              disabled={resetLoading}
              className="text-sm underline underline-offset-4 hover:opacity-80 disabled:opacity-50"
            >
              {resetLoading ? 'Sending…' : 'Forgot password?'}
            </button>
          </div>

          {resetMsg && <p className="text-sm text-neutral-600">{resetMsg}</p>}
        </form>

        <p className="mt-6 text-xs text-neutral-600">
          Need to change your password later? Go to <code className="rounded bg-neutral-100 px-1 py-0.5">/account/password</code>.
        </p>
      </div>
    </main>
  )
}

// --- Page wrapper avec Suspense (requis par Next pour useSearchParams) ---
export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-white dark:bg-white" />}>
      <LoginInner />
    </Suspense>
  )
}

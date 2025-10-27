'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseClient'
import type { Session } from '@supabase/supabase-js'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [ok, setOk] = useState(false)

  // Si pas de session, renvoyer vers login (le middleware protège déjà, mais double-sécurité UX)
  useEffect(() => {
    supabaseBrowser.auth.getSession().then((res) => {
      const session: Session | null = res.data.session
      if (!session) router.replace('/login?redirectTo=/set-password')
    })
  }, [router])

  useEffect(() => setError(''), [password, confirm])

  function validate(): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters'
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return 'Use letters and numbers (at least one of each)'
    }
    if (password !== confirm) return 'Passwords do not match'
    return null
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const msg = validate()
    if (msg) { setError(msg); return }

    setLoading(true)
    setError('')
    setOk(false)
    try {
      // Met à jour le mot de passe et enlève le flag "must_set_password"
      const { error } = await supabaseBrowser.auth.updateUser({
        password,
        data: { must_set_password: false },
      })
      if (error) throw error
      setOk(true)
      // Petite pause UX puis redirection à l’accueil
      setTimeout(() => { router.replace('/'); router.refresh() }, 600)
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Unable to set password'
      setError(m)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 bg-white p-6 text-black">
      <header>
        <h1 className="text-2xl font-semibold text-black">Set your password</h1>
        <p className="text-sm text-gray-700">Please choose a strong password.</p>
      </header>

      <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
        <label className="grid gap-1 text-sm text-black">
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-black placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-gray-300"
            placeholder="••••••••"
          />
        </label>

        <label className="grid gap-1 text-sm text-black">
          <span>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-black placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-gray-300"
            placeholder="••••••••"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && !error && <p className="text-sm text-green-600">Password updated. Redirecting…</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save password'}
        </button>
      </form>

      <p className="text-xs text-gray-700">
        Tip: minimum 8 characters, include at least one letter and one number.
      </p>
    </main>
  )
}

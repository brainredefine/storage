'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseClient'

// ========= Design tokens (sobre, sans carte) =========
const INPUT =
  'w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300'

export default function ChangePasswordPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [current, setCurrent] = useState('')
  const [nextPwd, setNextPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    supabaseBrowser.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email || '')
    })
  }, [])

  useEffect(() => setError(''), [current, nextPwd, confirm])

  function validate(): string | null {
    if (!current) return 'Current password required'
    if (nextPwd.length < 8) return 'New password must be at least 8 characters'
    if (!/[A-Za-z]/.test(nextPwd) || !/\d/.test(nextPwd)) return 'Use letters and numbers (at least one of each)'
    if (nextPwd === current) return 'New password must be different from current password'
    if (nextPwd !== confirm) return 'Passwords do not match'
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
      // Vérifie l'ancien mdp
      const { error: reauthErr } = await supabaseBrowser.auth.signInWithPassword({ email, password: current })
      if (reauthErr) throw new Error('Current password is incorrect')

      // Met à jour le mdp
      const { error } = await supabaseBrowser.auth.updateUser({ password: nextPwd })
      if (error) throw error

      // Invalide les autres sessions
      await supabaseBrowser.auth.signOut({ scope: 'others' })

      setOk(true)
      setCurrent(''); setNextPwd(''); setConfirm('')
      setTimeout(() => { router.replace('/'); router.refresh() }, 800)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md px-6 py-16">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Change password</h1>
          <p className="text-sm text-neutral-600">
            Signed in as <span className="font-medium">{email || '...'}</span>
          </p>
        </header>

        <form onSubmit={onSubmit} className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={INPUT}
              placeholder="••••••••"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={nextPwd}
              onChange={(e) => setNextPwd(e.target.value)}
              className={INPUT}
              placeholder="••••••••"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={INPUT}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {ok && !error && <p className="text-sm text-green-600">Password updated. Redirecting…</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save password'}
            </button>
          </div>
        </form>

        <p className="mt-6 text-xs text-neutral-600">
          Tip: minimum 8 characters, include at least one letter and one number.
        </p>
      </div>
    </main>
  )
}

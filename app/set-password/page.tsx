// app/set-password/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      // si pas loggué (lien expiré / mauvais flux) → retour login
      if (!data.user) {
        router.replace('/login')
      } else {
        setReady(true)
      }
    })()
  }, [router, supabase])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) {
      setError(error.message || 'Erreur')
      return
    }

    // Password OK → on peut rediriger vers l’app principale
    router.replace('/')
  }

  if (!ready) return null

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        <h1 className="text-xl font-semibold">Choisis ton mot de passe</h1>
        <input
          type="password"
          placeholder="Nouveau mot de passe"
          className="border rounded px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded px-3 py-2 border"
        >
          {loading ? 'En cours…' : 'Valider'}
        </button>
      </form>
    </main>
  )
}

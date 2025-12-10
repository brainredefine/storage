'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr' 
// ^ Note: on importe createBrowserClient ici si tu n'as pas un fichier global

export default function LoginClient() {
  const router = useRouter()
  // On crée le client directement ici ou importé depuis tes libs
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError("Identifiants incorrects") // Ou error.message pour le détail
      setLoading(false)
    } else {
      // Login réussi : On refresh pour que le Middleware détecte le nouveau cookie
      router.refresh()
      router.replace('/') 
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="w-full max-w-sm rounded bg-white p-8 shadow-md">
        <h2 className="mb-6 text-center text-2xl font-bold">Accès Interne</h2>
        
        <div className="mb-4">
          <label className="mb-2 block text-sm font-bold text-gray-700">Email</label>
          <input
            type="email"
            required
            className="w-full rounded border px-3 py-2 leading-tight text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        
        <div className="mb-6">
          <label className="mb-2 block text-sm font-bold text-gray-700">Mot de passe</label>
          <input
            type="password"
            required
            className="w-full rounded border px-3 py-2 leading-tight text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="mb-4 text-center text-sm text-red-500">{error}</p>}

        <button
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
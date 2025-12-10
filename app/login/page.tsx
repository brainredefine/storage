import LoginClient from './LoginClient'

// On garde ça car l'auth dépend des cookies (donnée dynamique)
export const dynamic = 'force-dynamic'

export default function Page() {
  // Plus besoin de searchParams, ni de Suspense
  // On affiche juste le formulaire brut.
  return <LoginClient />
}
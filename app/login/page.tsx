// app/login/page.tsx
import { Suspense } from 'react'
import LoginClient from './LoginClient'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { redirect?: string } }) {
  const redirect = searchParams?.redirect ?? '/'
  return (
    <Suspense fallback={null}>
      <LoginClient redirect={redirect} />
    </Suspense>
  )
}

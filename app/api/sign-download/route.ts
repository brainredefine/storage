// app/api/sign-download/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

type Body = { storage_path?: string; expiresIn?: number }

export async function POST(req: Request) {
  try {
    const { storage_path, expiresIn = 3600 } = (await req.json().catch(() => ({}))) as Body
    if (!storage_path) return NextResponse.json({ error: 'Missing storage_path' }, { status: 400 })

    const [bucket, ...rest] = storage_path.split('/')
    const path = rest.join('/')
    if (!bucket || !path) return NextResponse.json({ error: 'Invalid storage_path' }, { status: 400 })

    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresIn)
    if (error || !data?.signedUrl) throw error ?? new Error('Failed to sign download')

    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

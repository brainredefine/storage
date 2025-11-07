<<<<<<< HEAD
// app/api/sign-download/route.ts  (ou src/app/... si tu as un dossier src)
=======
// app/api/sign-download/route.ts
>>>>>>> 69fa770cfc823c47d3d007a8e8e3473ffa8708db
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
<<<<<<< HEAD
export const dynamic = 'force-dynamic'

type Body = { storage_path?: string; expiresIn?: number }

function parseStoragePath(input: string) {
  const trimmed = input.trim().replace(/^\/+/, '')
  const [bucket, ...rest] = trimmed.split('/')
  const path = rest.join('/').trim()
  if (!bucket || !path) return null
  return { bucket, path }
}
function splitDirFile(path: string) {
  const idx = path.lastIndexOf('/')
  if (idx === -1) return { dir: '', file: path }
  return { dir: path.slice(0, idx), file: path.slice(idx + 1) }
}

// ✅ PING: si ça répond “ok”, la route est bien trouvée
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
    }

    // Vérif env pour éviter un client invalide silencieux
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Supabase env missing: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      )
    }

    const { storage_path, expiresIn = 3600 } = (await req.json().catch(() => ({}))) as Body
    if (!storage_path) return NextResponse.json({ error: 'Missing storage_path' }, { status: 400 })

    const parsed = parseStoragePath(storage_path)
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid storage_path. Expected "bucket/path/to/file.ext"' },
        { status: 400 }
      )
    }

    // Check existence (retourne 404 lisible si absent)
    const { dir, file } = splitDirFile(parsed.path)
    const { data: listed, error: listErr } = await supabaseAdmin.storage
      .from(parsed.bucket)
      .list(dir || '', { limit: 1, search: file })

    if (listErr) {
      console.error('[sign-download] list error', { bucket: parsed.bucket, dir, file, listErr })
      return NextResponse.json({ error: listErr.message }, { status: 500 })
    }
    const exists = (listed || []).some((o) => o.name === file)
    if (!exists) {
      return NextResponse.json(
        { error: 'File not found in bucket', bucket: parsed.bucket, path: parsed.path },
        { status: 404 }
      )
    }

    const exp =
      Number.isFinite(expiresIn) ? Math.max(60, Math.min(7 * 24 * 3600, Math.floor(expiresIn))) : 3600

    const { data, error } = await supabaseAdmin.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, exp)

    if (error || !data?.signedUrl) {
      console.error('[sign-download] createSignedUrl error', { bucket: parsed.bucket, path: parsed.path, error })
      return NextResponse.json({ error: error?.message || 'Failed to sign download' }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch (e) {
    console.error('[sign-download] unexpected', e)
    const msg = e instanceof Error ? e.message : 'Internal error'
=======

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
>>>>>>> 69fa770cfc823c47d3d007a8e8e3473ffa8708db
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

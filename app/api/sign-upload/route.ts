// app/api/sign-upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Configuration
 */
const INBOX_BUCKET = 'inbox'
const ALLOWED_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx'] as const
type AllowedExt = (typeof ALLOWED_EXTS)[number]

/**
 * Types
 */
type UploadPayload = {
  type?: string
  date?: string
  asset?: string
  tenant?: string
  suffix?: string
  originalFilename?: string
  ext?: string
}

/**
 * Helpers
 */
function coerceExt(raw?: string | null): AllowedExt {
  const ext = (raw || '').trim().toLowerCase()
  if ((ALLOWED_EXTS as readonly string[]).includes(ext)) return ext as AllowedExt
  return 'pdf'
}

function sanitizeSegment(s?: string | null): string | null {
  if (!s) return null
  const t = s
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-') // caractères interdits
    .replace(/\s+/g, ' ')          // espaces multiples
    .replace(/-+/g, '-')           // tirets multiples
  return t.length ? t : null
}

function normalizeAsset(raw?: string | null): string | null {
  if (!raw) return null
  const s = raw.trim().replace(/\s+/g, '')
  return s ? s.toUpperCase() : null
}

function normalizeDate(dateRaw?: string | null): string | null {
  if (!dateRaw) return null
  const s = dateRaw.trim()
  if (/^\d{4}$/.test(s)) return `${s}-01-01`
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

// hash court & stable -> base36 6 chars
function shortCode(input: string): string {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return (h >>> 0).toString(36).slice(0, 6)
}

/**
 * Construit le nom de base (sans tag u-xxxxxx).
 * Format strict: type_date[_asset][_tenant][_suffix].ext
 */
function buildBaseName(opts: {
  type: string
  date: string
  asset?: string | null
  tenant?: string | null
  suffix?: string | null
  originalFilename?: string | null
  ext: AllowedExt
}): string {
  const type = (opts.type || '').trim()
  if (!type) throw new Error('type_required')

  const date = normalizeDate(opts.date)
  if (!date) throw new Error('date_invalid')

  const parts: string[] = []
  parts.push(type)
  parts.push(date)

  const asset = normalizeAsset(opts.asset || null)
  if (asset) parts.push(asset)

  const tenant = sanitizeSegment(opts.tenant || null)
  if (tenant) parts.push(tenant)

  const suffix = sanitizeSegment(opts.suffix || null)
  if (suffix) parts.push(suffix)

  return `${parts.join('_')}.${opts.ext}`
}

/**
 * Ajoute _u-xxxxxx avant l’extension
 */
function appendPersonTag(base: string, personTag?: string | null) {
  if (!personTag) return base
  const dot = base.lastIndexOf('.')
  if (dot === -1) return `${base}_${personTag}`
  return `${base.slice(0, dot)}_${personTag}${base.slice(dot)}`
}

/**
 * Handler
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // lecture payload
    const body = (await req.json().catch(() => ({}))) as UploadPayload
    const {
      type,
      date,
      asset,
      tenant,
      suffix,
      originalFilename,
      ext: extFromClient,
    } = body

    // auth: nécessaire pour générer le tag uploadeur
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    // extension : d’abord via payload.ext, sinon via originalFilename, sinon PDF
    const payloadExt = coerceExt(extFromClient)
    const inferredExt = coerceExt((originalFilename || '').split('.').pop())
    const ext: AllowedExt = payloadExt || inferredExt || 'pdf'

    // nom de base strict (sans tag)
    const baseName = buildBaseName({
      type: String(type || ''),
      date: String(date || ''),
      asset: asset ?? null,
      tenant: tenant ?? null,
      suffix: suffix ?? null,
      originalFilename: originalFilename ?? null,
      ext,
    })

    // tag d’uploadeur (stable)
    const code = shortCode(user.id || user.email || 'anon')
    const personTag = `u-${code}`

    // nom final signé (ajout du tag)
    const finalName = appendPersonTag(baseName, personTag)

    // URL signée PUT vers le bucket INBOX
    const { data: signed, error: signErr } = await supabase.storage
      .from(INBOX_BUCKET)
      .createSignedUploadUrl(finalName)

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signErr?.message ?? 'sign_failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      signedUrl: signed.signedUrl,
      path: finalName, // où uploader dans INBOX
      baseName,        // sans le tag (info)
      personTag,       // ex: u-abc123 (info)
      bucket: INBOX_BUCKET,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

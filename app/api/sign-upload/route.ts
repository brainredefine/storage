import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Config
 */
const INBOX_BUCKET = 'inbox'
const ALLOWED_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx'] as const
type AllowedExt = (typeof ALLOWED_EXTS)[number]

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
    .replace(/[\\/:*?"<>|]/g, '-') // caractères interdits pour chemins
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
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

/**
 * Construit le nom de base (sans email).
 * Format: type_date[_asset][_tenant][_suffix].ext
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
 * On ajoute le suffixe email avant l’extension (en gardant le '@' pour détection).
 * On supprime uniquement les caractères non valides pour un chemin (on garde @.+-_)
 */
function appendEmailSuffix(base: string, email: string) {
  const safeEmail = email.trim().replace(/[\\/:*?"<>|]/g, '') // retire séparateurs/forbidden
  const dot = base.lastIndexOf('.')
  if (dot === -1) return `${base}_${safeEmail}`
  return `${base.slice(0, dot)}_${safeEmail}${base.slice(dot)}`
}

/**
 * Handler
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const body = (await req.json().catch(() => ({}))) as UploadPayload
    const { type, date, asset, tenant, suffix, originalFilename, ext: extFromClient } = body

    // Auth: on a besoin de l'email
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user || !user.email) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    // extension : payload > originalFilename > pdf
    const payloadExt = coerceExt(extFromClient)
    const inferredExt = coerceExt((originalFilename || '').split('.').pop())
    const ext: AllowedExt = payloadExt || inferredExt || 'pdf'

    // nom de base sans email
    const baseName = buildBaseName({
      type: String(type || ''),
      date: String(date || ''),
      asset: asset ?? null,
      tenant: tenant ?? null,
      suffix: suffix ?? null,
      originalFilename: originalFilename ?? null,
      ext,
    })

    // suffixe email (pour que la Edge le détecte et le retire)
    const finalName = appendEmailSuffix(baseName, user.email)

    // URL signée PUT vers INBOX
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
      path: finalName,   // INBOX/<finalName> (avec email)
      baseName,          // sans email (info)
      email: user.email, // info
      bucket: INBOX_BUCKET,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

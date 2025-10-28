import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

type SignBody = {
  type: string
  date?: string
  asset?: string
  tenant?: string
  suffix?: string
  originalFilename: string
}

type UploadTypeRow = {
  type: string
  requires_asset: boolean
  requires_tenant: boolean
  require_strict: boolean
}

type SignedUploadUrlData = {
  signedUrl: string
  path: string
}

const DATE_FLEX = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/
function isValidFlexibleDate(input?: string | null): boolean {
  if (!input) return false
  return DATE_FLEX.test(input.trim())
}

function sanitizeTenantPreserveCase(input: string) {
  return input.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').replace(/-+/g, '-')
}
function slugify(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-')
}

function buildFilename(args: {
  type: string
  date?: string | null
  asset?: string | null
  tenant?: string | null
  suffix?: string | null
  originalFilename: string
}) {
  const { type, date, asset, tenant, suffix, originalFilename } = args
  const ext = (originalFilename.split('.').pop() || '').toLowerCase()
  const parts: string[] = [type]
  if (date) parts.push(date)
  if (asset) parts.push(asset)
  if (tenant) parts.push(sanitizeTenantPreserveCase(tenant))
  if (suffix) parts.push(slugify(suffix))
  return `${parts.join('_')}.${ext || 'pdf'}`
}

// Try v_upload_types first, fallback to type_routes
async function fetchTypeRule(typeTrim: string): Promise<UploadTypeRow | null> {
  const cols = 'type, requires_asset, requires_tenant, require_strict'

  // v_upload_types
  let r = await supabaseAdmin
    .from('v_upload_types')
    .select(cols)
    .ilike('type', typeTrim)
    .limit(1)

  if (!r.error && r.data && r.data.length) {
    return r.data[0] as UploadTypeRow
  }

  // fallback type_routes
  r = await supabaseAdmin
    .from('type_routes')
    .select(cols)
    .ilike('type', typeTrim)
    .limit(1)

  if (!r.error && r.data && r.data.length) {
    return r.data[0] as UploadTypeRow
  }

  if (r.error) throw r.error
  return null
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as Partial<SignBody>
    const { type, date, asset, tenant, suffix, originalFilename } = raw

    if (!type || !originalFilename) {
      return NextResponse.json({ error: 'Missing type or file name' }, { status: 400 })
    }

    const typeTrim = type.trim()
    const isOther = typeTrim.toLowerCase() === 'other'

    let rules: UploadTypeRow | null = null
    if (!isOther) {
      rules = await fetchTypeRule(typeTrim)
      if (!rules) return NextResponse.json({ error: 'Unknown type' }, { status: 400 })

      if (rules.require_strict) {
        if (!date) return NextResponse.json({ error: 'Date required for strict type' }, { status: 400 })
        if (!isValidFlexibleDate(date)) return NextResponse.json({ error: 'Invalid date format (use YYYY or YYYY-MM or YYYY-MM-DD)' }, { status: 400 })
        if (rules.requires_asset && !asset) return NextResponse.json({ error: 'Asset required for this type' }, { status: 400 })
        if (rules.requires_tenant && !tenant) return NextResponse.json({ error: 'Tenant required for this type' }, { status: 400 })
      } else {
        if (date && !isValidFlexibleDate(date)) {
          return NextResponse.json({ error: 'Invalid date format (use YYYY or YYYY-MM or YYYY-MM-DD)' }, { status: 400 })
        }
      }
    } else {
      if (date && !isValidFlexibleDate(date)) {
        return NextResponse.json({ error: 'Invalid date format (use YYYY or YYYY-MM or YYYY-MM-DD)' }, { status: 400 })
      }
    }

    const finalName = buildFilename({
      type: typeTrim,
      date: date ?? null,
      asset: asset ?? null,
      tenant: tenant ?? null,
      suffix: suffix ?? null,
      originalFilename,
    })

    const bucket = isOther ? (process.env.TBD_BUCKET || 'tbd') : (process.env.INBOX_BUCKET || 'inbox')

    const { data: signed, error: sErr } = await supabaseAdmin
      .storage
      .from(bucket)
      .createSignedUploadUrl(finalName)

    if (sErr || !signed) throw sErr ?? new Error('Failed to create signed upload URL')

    const routedTo: 'tbd' | 'inbox' = isOther ? 'tbd' : 'inbox'

    return NextResponse.json({
      signedUrl: (signed as SignedUploadUrlData).signedUrl,
      bucket,
      path: `${bucket}/${finalName}`,
      finalName,
      rules,
      routedTo,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

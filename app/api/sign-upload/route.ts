// app/api/sign-upload/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

// ===== Types =====
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
  allow_keyword: boolean
  aliases: string[] | null
}

type AssetRow = { asset: string }

type SignedUploadUrlData = {
  signedUrl: string
  path: string
}

// YYYY | YYYY-MM | YYYY-MM-DD
const DATE_FLEX = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/

function isValidFlexibleDate(input?: string | null): boolean {
  if (!input) return false
  return DATE_FLEX.test(input.trim())
}

// garde la casse du tenant, remplace seulement les caractères illégaux dans un nom de fichier
function sanitizeTenantPreserveCase(input: string) {
  return input
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-') // caractères interdits
    .replace(/\s+/g, ' ')          // normalise les espaces (mais on les garde)
    .replace(/-+/g, '-')           // compacte les suites de -
}

// on garde le slug pour le suffix optionnel (pratique)
function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
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
  const parts: string[] = [type]             // type en minuscules (comme avant)
  if (date) parts.push(date)
  if (asset) parts.push(asset)
  if (tenant) parts.push(sanitizeTenantPreserveCase(tenant)) // au lieu de slugifier en minuscules
  if (suffix) parts.push(slugify(suffix))                   // suffixe reste slugifié
  return `${parts.join('_')}.${ext || 'pdf'}`
}

export async function POST(req: Request) {
  try {
    // -------- Parse & validate body --------
    const raw = (await req.json().catch(() => ({}))) as Partial<SignBody>
    const { type, date, asset, tenant, suffix, originalFilename } = raw

    if (!type || !originalFilename) {
      return NextResponse.json({ error: 'Missing type or file name' }, { status: 400 })
    }

    const typeLc = type.toLowerCase()
    const isOther = typeLc === 'other'

    // -------- Rules for known types --------
    let rules: UploadTypeRow | null = null

    if (!isOther) {
      const { data: trows, error: terr } = await supabaseAdmin
        .from('v_upload_types')
        .select<string, UploadTypeRow>('*')
        .eq('type', typeLc)
        .limit(1)

      if (terr) throw terr
      rules = trows?.[0] ?? null
      if (!rules) {
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
      }

      if (rules.require_strict) {
        if (!date) {
          return NextResponse.json({ error: 'Date required for strict type' }, { status: 400 })
        }
        if (!isValidFlexibleDate(date)) {
          return NextResponse.json(
            { error: 'Invalid date format (use YYYY or YYYY-MM or YYYY-MM-DD)' },
            { status: 400 }
          )
        }
        if (rules.requires_asset && !asset) {
          return NextResponse.json({ error: 'Asset required for this type' }, { status: 400 })
        }
        if (rules.requires_tenant && !tenant) {
          return NextResponse.json({ error: 'Tenant required for this type' }, { status: 400 })
        }
      } else {
        if (date && !isValidFlexibleDate(date)) {
          return NextResponse.json(
            { error: 'Invalid date format (use YYYY or YYYY-MM or YYYY-MM-DD)' },
            { status: 400 }
          )
        }
      }

      // Validate asset when provided
      if (asset) {
        const { data: arows, error: aerr } = await supabaseAdmin
          .from('v_upload_assets')
          .select<string, AssetRow>('asset')
          .eq('asset', asset)
          .limit(1)

        if (aerr) throw aerr
        if (!arows || arows.length === 0) {
          return NextResponse.json({ error: 'Unknown asset' }, { status: 400 })
        }
      }
    } else {
      // Type "other" → minimal constraints
      if (date && !isValidFlexibleDate(date)) {
        return NextResponse.json(
          { error: 'Invalid date format (use YYYY or YYYY-MM or YYYY-MM-DD)' },
          { status: 400 }
        )
      }
    }

    // -------- Build final name & bucket --------
    const finalName = buildFilename({
      type: typeLc,
      date: date ?? null,
      asset: asset ?? null,
      tenant: tenant ?? null,   // <-- on passe le tenant tel que fourni (casse préservée)
      suffix: suffix ?? null,
      originalFilename,
    })

    const bucket = isOther
      ? (process.env.TBD_BUCKET || 'tbd')
      : (process.env.INBOX_BUCKET || 'inbox')

    // -------- Signed upload URL --------
    const { data: signed, error: sErr } = await supabaseAdmin
      .storage
      .from(bucket)
      .createSignedUploadUrl(finalName)

    if (sErr || !signed) {
      throw sErr ?? new Error('Failed to create signed upload URL')
    }

    const payload: {
      signedUrl: string
      bucket: string
      path: string
      finalName: string
      rules: UploadTypeRow | null
      routedTo: 'tbd' | 'inbox'
    } = {
      signedUrl: (signed as SignedUploadUrlData).signedUrl,
      bucket,
      path: `${bucket}/${finalName}`,
      finalName,
      rules,
      routedTo: isOther ? 'tbd' : 'inbox',
    }

    return NextResponse.json(payload)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error(e)
    return NextResponse.json({ error: msg } as Record<string, unknown>, { status: 500 })
  }
}

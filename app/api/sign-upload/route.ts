// app/api/sign-upload/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

// YYYY | YYYY-MM | YYYY-MM-DD
const DATE_FLEX = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/

function isValidFlexibleDate(input?: string | null): boolean {
  if (!input) return false
  return DATE_FLEX.test(input.trim())
}

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
  const parts: string[] = [type]
  if (date) parts.push(date)            // toujours possible
  if (asset) parts.push(asset)
  if (tenant) parts.push(slugify(tenant))
  if (suffix) parts.push(slugify(suffix))
  return `${parts.join('_')}.${ext || 'pdf'}`
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      type,
      date,
      asset,
      tenant,
      suffix,
      originalFilename,
    }: {
      type?: string
      date?: string
      asset?: string
      tenant?: string
      suffix?: string
      originalFilename?: string
    } = body

    if (!type || !originalFilename) {
      return NextResponse.json({ error: 'Missing type or file name' }, { status: 400 })
    }

    const typeLc = type.toLowerCase()
    const isOther = typeLc === 'other'

    // 1) Règles
    let t: any = null
    if (!isOther) {
      // Types connus (lease, pmreporting, etc.) → on applique les règles
      const { data: trows, error: terr } = await supabaseAdmin
        .from('v_upload_types')
        .select('*')
        .eq('type', typeLc)
        .limit(1)
      if (terr) throw terr
      t = trows?.[0]
      if (!t) return NextResponse.json({ error: 'Unknown type' }, { status: 400 })

      if (t.require_strict) {
        if (!date) return NextResponse.json({ error: 'Date required for strict type' }, { status: 400 })
        if (!isValidFlexibleDate(date)) {
          return NextResponse.json(
            { error: 'Invalid date format (use YYYY or YYYY-MM or YYYY-MM-DD)' },
            { status: 400 }
          )
        }
        if (t.requires_asset && !asset) {
          return NextResponse.json({ error: 'Asset required for this type' }, { status: 400 })
        }
        if (t.requires_tenant && !tenant) {
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

      // Asset connu si fourni
      if (asset) {
        const { data: arows, error: aerr } = await supabaseAdmin
          .from('v_upload_assets')
          .select('asset')
          .eq('asset', asset)
          .limit(1)
        if (aerr) throw aerr
        if (!arows?.length) return NextResponse.json({ error: 'Unknown asset' }, { status: 400 })
      }
    } else {
      // Type "other" → contraintes minimales
      if (date && !isValidFlexibleDate(date)) {
        return NextResponse.json(
          { error: 'Invalid date format (use YYYY or YYYY-MM or YYYY-MM-DD)' },
          { status: 400 }
        )
      }
      // pas de vérif d'asset/tenant (libre)
    }

    // 2) Nom final
    const finalName = buildFilename({
      type: typeLc,
      date: date ?? null,
      asset: asset ?? null,
      tenant: tenant ?? null,
      suffix: suffix ?? null,
      originalFilename,
    })

    // 3) Bucket dynamique: other -> tbd / sinon -> inbox
    const bucket =
      isOther ? (process.env.TBD_BUCKET || 'tbd') : (process.env.INBOX_BUCKET || 'inbox')

    // 4) URL signée
    const { data: signed, error: sErr } = await supabaseAdmin
      .storage.from(bucket)
      .createSignedUploadUrl(finalName)
    if (sErr) throw sErr

    return NextResponse.json({
      signedUrl: signed.signedUrl,
      bucket,
      path: `${bucket}/${finalName}`,
      finalName,
      rules: t,
      routedTo: isOther ? 'tbd' : 'inbox',
    })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buildMetaFilename } from '@/lib/metaName'

const INBOX_BUCKET = 'inbox'
const ALLOWED_EXTS = new Set(['pdf','png','jpg','jpeg','docx','xlsx','txt'])

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const {
      type,
      date,                 // optionnelle
      asset,                // si type_f === 'asset'
      spv,                  // si type_f === 'spv'
      fund,                 // si type_f === 'fund'
      type_name = '',
      originalFilename,
      rightNumberAlready = false,
      tenant_no,
      type_f = 'asset',     // 'asset' | 'spv' | 'fund'
      tmail,                // ← NEW: email de l’uploader (optionnel)
    } = payload ?? {}

    if (!originalFilename) {
      return NextResponse.json({ error: 'Missing originalFilename' }, { status: 400 })
    }

    // extension whitelist
    const dot = originalFilename.lastIndexOf('.')
    const ext = dot >= 0 ? originalFilename.slice(dot + 1).toLowerCase() : ''
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: `unsupported_extension (${ext})` }, { status: 400 })
    }

    // compute final code
    let code = String(type || '').trim()
    if (rightNumberAlready) {
      if (!code) return NextResponse.json({ error: 'type_missing_when_rightNumberAlready' }, { status: 400 })
    } else {
      if (!code) return NextResponse.json({ error: 'Missing type' }, { status: 400 })
      const is17 = /^1\.7(\.|$)/.test(code)
      const is1951 = /^1\.9\.5\.1(\.|$)/.test(code)
      const segs = code.split('.')
      const expectLen = is17 ? 3 : (is1951 ? 4 : 0)
      if (expectLen > 0 && segs.length === expectLen && (tenant_no ?? '') !== '') {
        code = `${code}.${tenant_no}`
      }
    }

    // date facultative : si fournie, on valide le format
    const dateStr = String(date ?? '').trim()
    if (dateStr && !/^\d{4}(?:-\d{2})?$/.test(dateStr)) {
      return NextResponse.json({ error: 'Invalid date (YYYY or YYYY-MM)' }, { status: 400 })
    }

    // scope + tags selon scope
    const scope = String(type_f).trim().toLowerCase()
    if (!['asset','spv','fund'].includes(scope)) {
      return NextResponse.json({ error: 'invalid tscope/type_f' }, { status: 400 })
    }

    const tags: Record<string, string> = {
      ttype: code,
      tname: String(type_name).trim(),
      tscope: scope,
    }
    if (dateStr) tags.tdate = dateStr
    if (tmail) tags.tmail = String(tmail).trim()

    if (scope === 'asset') {
      if (!asset) return NextResponse.json({ error: 'Missing asset' }, { status: 400 })
      tags.tasset = String(asset).trim()
    } else if (scope === 'spv') {
      if (!spv) return NextResponse.json({ error: 'Missing spv' }, { status: 400 })
      tags.tspv = String(spv).trim()
    } else if (scope === 'fund') {
      if (!fund) return NextResponse.json({ error: 'Missing fund' }, { status: 400 })
      tags.tfund = String(fund).trim()
    }

    const finalName = buildMetaFilename(tags, originalFilename)

    const { data, error } = await supabaseAdmin.storage
      .from(INBOX_BUCKET)
      .createSignedUploadUrl(finalName)

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? 'sign_failed' }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: data.signedUrl, path: finalName })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

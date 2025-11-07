// lib/metaName.ts
const META_PREFIX = 'm' // simple, lisible

type TagDict = Record<string, string>

// URL-safe encode/decode (strict RFC3986)
function enc(v: string): string {
  return encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}
function dec(v: string): string {
  try { return decodeURIComponent(v) } catch { return v }
}

// Build: tags -> "m(k=v)(k=v)..."
export function buildMetaBase(tags: TagDict): string {
  const blocks: string[] = []
  for (const [kRaw, vRaw] of Object.entries(tags)) {
    const k = kRaw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!k) continue
    const v = enc(String(vRaw ?? ''))
    blocks.push(`(${k}=${v})`)
  }
  return `${META_PREFIX}${blocks.join('')}`
}

// Parse: "m(k=v)(k=v)..." -> tags
export function parseMetaBase(base: string): TagDict | null {
  if (!base || base[0] !== META_PREFIX) return null
  const out: TagDict = {}
  // scan parentheses blocks: (key=value)
  let i = 1
  while (i < base.length) {
    if (base[i] !== '(') break
    const close = base.indexOf(')', i + 1)
    if (close === -1) return null
    const inner = base.slice(i + 1, close) // "key=value"
    const eq = inner.indexOf('=')
    if (eq <= 0) return null
    const key = inner.slice(0, eq).trim().toLowerCase()
    const val = inner.slice(eq + 1)
    if (!/^[a-z0-9_-]+$/.test(key)) return null
    out[key] = dec(val)
    i = close + 1
  }
  return out
}

// With extension handling
export function buildMetaFilename(tags: TagDict, originalFilename: string): string {
  const dot = originalFilename.lastIndexOf('.')
  const ext = dot >= 0 ? originalFilename.slice(dot + 1) : ''
  const base = buildMetaBase(tags)
  return ext ? `${base}.${ext}` : base
}

export function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? { base: name.slice(0, dot), ext: name.slice(dot + 1) } : { base: name, ext: '' }
}

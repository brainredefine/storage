'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabaseClient'

/* ---------- UI tokens ---------- */
const TOKENS = {
  radius: 'rounded-2xl',
  border: 'border border-neutral-300 dark:border-neutral-700',
  surface: 'bg-white dark:bg-neutral-900',
  text: 'text-neutral-900 dark:text-neutral-100',
  subtext: 'text-neutral-500 dark:text-neutral-400',
  focus: 'focus:ring-2 focus:ring-neutral-300 focus:outline-none',
} as const
const INPUT_BASE = `w-full ${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-2 ${TOKENS.text} placeholder:text-neutral-400 ${TOKENS.focus}`
const LABEL_BASE = 'text-sm font-medium text-neutral-800 dark:text-neutral-100'
const HELP_TEXT = 'text-xs text-neutral-500 dark:text-neutral-400'
const DATE_PLACEHOLDER = 'YYYY or YYYY-MM or YYYY-MM-DD'

/* ---------- Types ---------- */
type DocRow = {
  id: string
  type: string | null
  storage_path: string
  name: string | null
  asset: string | null
  spv: string | null
  tenant: string | null
  doc_date: string | null
  created_at: string
}
type TypePathRow = { code: string; display_name: string }

/* ---------- Helpers ---------- */
function uniqCaseInsensitive(source: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of source) {
    const v = raw.trim()
    if (!v) continue
    const k = v.toLowerCase()
    if (!seen.has(k)) { seen.add(k); out.push(v) }
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
function useFilter(options: readonly string[], query: string): string[] {
  const q = (query || '').toLowerCase()
  return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 100)
}

// Display helper: show only the filename while keeping full path in data
function filenameFromPath(p: string): string {
  const full = p.startsWith('docs/') ? p : `docs/${p}`
  const parts = full.split('/')
  return parts[parts.length - 1] || full
}

type ComboBoxProps = {
  label: string
  value: string
  setValue: (s: string) => void
  options: readonly string[]
  placeholder?: string
  required?: boolean
  noResultsLabel?: string
}
function ComboBox({
  label, value, setValue, options, placeholder = '', required = false, noResultsLabel = 'No results',
}: ComboBoxProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState<number>(-1)
  const listRef = useRef<HTMLUListElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const filtered = useFilter(options, value)
  const hasOptions = filtered.length > 0
  const listboxId = useMemo(() => `listbox-${Math.random().toString(36).slice(2)}` , [])

  function commitSelection(v: string) {
    setValue(v); setOpen(false); setHighlight(-1); inputRef.current?.focus()
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) setOpen(true)
    if (!hasOptions) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % filtered.length) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1)) }
    if (e.key === 'Home')      { e.preventDefault(); setHighlight(0) }
    if (e.key === 'End')       { e.preventDefault(); setHighlight(filtered.length - 1) }
    if (e.key === 'Enter' && highlight >= 0) { e.preventDefault(); commitSelection(filtered[highlight]!) }
    if (e.key === 'Escape') { setOpen(false); setHighlight(-1) }
  }
  useEffect(() => {
    if (!listRef.current) return
    listRef.current.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlight])
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return
      const t = e.target as Node
      if (!listRef.current?.parentElement?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="grid gap-1 relative">
      <label className={LABEL_BASE}>
        {label}{' '}
        {required ? <span className="text-red-600 dark:text-red-400" aria-hidden>*</span> : <small className={HELP_TEXT}>(optional)</small>}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); setHighlight(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-activedescendant={highlight >= 0 ? `${listboxId}-option-${highlight}` : undefined}
          placeholder={placeholder}
          className={`${INPUT_BASE} pr-10`}
          autoComplete="off"
        />
        <button
          type="button"
          aria-label={value ? 'Clear' : 'Toggle'}
          onClick={() => (value ? setValue('') : setOpen((v) => !v))}
          className={`absolute inset-y-0 right-0 grid w-10 place-items-center ${TOKENS.radius} text-neutral-500 hover:text-neutral-700`}
        >
          {value ? <span aria-hidden>&times;</span> : <span aria-hidden>▾</span>}
        </button>
      </div>
      {open && (
        <div className={`absolute z-50 mt-1 w-full overflow-hidden ${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} shadow-lg`}>
          <ul ref={listRef} id={listboxId} role="listbox" className="max-h-60 overflow-auto py-1 outline-none">
            {hasOptions ? (
              filtered.map((opt, i) => (
                <li
                  key={`${opt}-${i}`}
                  id={`${listboxId}-option-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === highlight}
                  className={`cursor-pointer px-3 py-2 text-sm ${i === highlight ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/70'} ${TOKENS.text}`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commitSelection(opt)}
                >
                  {opt}
                </li>
              ))
            ) : (
              <li className={`px-3 py-2 text-sm ${TOKENS.subtext}`}>{noResultsLabel}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ---------- Date filter ---------- */
const DATE_FLEX = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/
function buildDateFilter(date: string): { from: string; to: string } | { exact: string } | null {
  if (!date || !DATE_FLEX.test(date)) return null
  const [yStr, mStr, dStr] = date.split('-')
  const y = Number(yStr)
  const m = mStr ? Number(mStr) : undefined
  const d = dStr ? Number(dStr) : undefined

  if (!m) {
    return { from: `${y}-01-01`, to: `${y + 1}-01-01` }
  }
  if (!d) {
    const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
    return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${next.y}-${String(next.m).padStart(2, '0')}-01` }
  }
  return { exact: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
}

/* ---------- Page ---------- */
const PAGE_SIZE = 50

export default function Page() {
  // type filter: display_name -> code
  const [typeDisplay, setTypeDisplay] = useState<string>('')
  const [typeOptions, setTypeOptions] = useState<string[]>([])
  const [typeMap, setTypeMap] = useState<Map<string, string>>(new Map())

  // other filters
  const [assets, setAssets] = useState<string[]>([])
  const [spvs, setSpvs] = useState<string[]>([])
  const [tenants, setTenants] = useState<string[]>([])
  const [asset, setAsset] = useState<string>('')
  const [spv, setSpv] = useState<string>('')
  const [tenant, setTenant] = useState<string>('')
  const [date, setDate] = useState<string>('')

  const dateError = date && !DATE_FLEX.test(date) ? 'Invalid format. Example: 2024 or 2024-09 or 2024-09-30' : ''

  // data
  const [rows, setRows] = useState<DocRow[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [total, setTotal] = useState<number | null>(null)
  const [signingId, setSigningId] = useState<string | null>(null)

  // Populate filters
  useEffect(() => {
    void (async () => {
      // TYPES
      const { data: tpData } = await supabaseBrowser
        .from('type_paths')
        .select('code, display_name')
        .order('code', { ascending: true })
      const tps = (tpData as ReadonlyArray<TypePathRow> | null) ?? []
      const map = new Map<string, string>()
      const opts: string[] = []
      for (const r of tps) {
        const disp = r.display_name?.trim() ?? ''
        const code = r.code?.trim() ?? ''
        if (!disp || !code) continue
        if (!map.has(disp)) { map.set(disp, code); opts.push(disp) }
      }
      opts.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      setTypeMap(map); setTypeOptions(opts)

      // ASSETS
      const { data: aData } = await supabaseBrowser
        .from('documents')
        .select('asset')
        .not('asset', 'is', null)
        .order('asset', { ascending: true })
      const listA = ((aData as ReadonlyArray<{ asset: string | null }> | null) ?? [])
        .map((r) => r.asset?.trim() ?? '')
        .filter((s) => s.length > 0)
      setAssets(uniqCaseInsensitive(listA))

      // SPVs
      const { data: sData } = await supabaseBrowser
        .from('documents')
        .select('spv')
        .not('spv', 'is', null)
        .order('spv', { ascending: true })
      const listS = ((sData as ReadonlyArray<{ spv: string | null }> | null) ?? [])
        .map((r) => r.spv?.trim() ?? '')
        .filter((s) => s.length > 0)
      setSpvs(uniqCaseInsensitive(listS))
    })()
  }, [])

  // Tenants for selected asset
  useEffect(() => {
    if (!asset) { setTenants([]); return }
    void (async () => {
      const { data } = await supabaseBrowser
        .from('documents')
        .select('tenant')
        .eq('asset', asset)
        .not('tenant', 'is', null)
        .order('tenant', { ascending: true })
      const list = ((data as ReadonlyArray<{ tenant: string | null }> | null) ?? [])
        .map((r) => r.tenant?.trim() ?? '')
        .filter((s) => s.length > 0)
      setTenants(uniqCaseInsensitive(list))
    })()
  }, [asset])

  async function runSearch(goToPage?: number) {
    setLoading(true)
    setError('')
    try {
      const pg = goToPage ?? 1
      const from = (pg - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let q = supabaseBrowser
        .from('documents')
        .select('id,type,storage_path,name,asset,spv,tenant,doc_date,created_at', { count: 'exact' })
        .order('doc_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      // TYPE -> code prefix
      const typeDisplayTrimmed = typeDisplay.trim()
      if (typeDisplayTrimmed.length > 0) {
        const code = typeMap.get(typeDisplayTrimmed)
        q = code ? q.ilike('type', `${code}%`) : q.ilike('type', `${typeDisplayTrimmed}%`)
      }
      if (asset.trim().length > 0) q = q.eq('asset', asset.trim())
      if (spv.trim().length > 0)   q = q.eq('spv', spv.trim())
      if (tenant.trim().length > 0) q = q.eq('tenant', tenant.trim())

      const df = buildDateFilter(date.trim())
      if (df) {
        if ('exact' in df) q = q.eq('doc_date', df.exact)
        else q = q.gte('doc_date', df.from).lt('doc_date', df.to)
      }

      q = q.range(from, to)

      const { data, error: qErr, count } = await q
      if (qErr) throw qErr
      const got = (data as ReadonlyArray<DocRow> | null) ?? []
      setRows([...got])
      setTotal(typeof count === 'number' ? count : null)
      setPage(pg)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la récupération des documents.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Sign + open
  async function openSigned(r: DocRow) {
    try {
      setSigningId(r.id)
      const fullPath = r.storage_path.startsWith('docs/') ? r.storage_path : `docs/${r.storage_path}`
      const res = await fetch('/api/sign-download', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storage_path: fullPath, expiresIn: 3600 }),
      })
      const j: unknown = await res.json().catch(() => ({}))
      const payload = j as { signedUrl?: string; error?: string }
      if (!res.ok || !payload?.signedUrl) throw new Error(payload?.error ?? 'Signature échouée')
      window.open(payload.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Impossible d’ouvrir le document'
      alert(msg)
    } finally {
      setSigningId(null)
    }
  }

  const totalPages = total == null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <main className="mx-auto max-w-5xl p-6">
      {/* Top buttons -> redirect to app/page.tsx (/) */}
      

      <header className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Documents</h1>
      </header>

      <section className={`grid gap-5 ${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} p-5 shadow-sm`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <ComboBox
            label="Type"
            value={typeDisplay}
            setValue={setTypeDisplay}
            options={typeOptions}
            placeholder={typeOptions.length ? 'Search types…' : 'Loading…'}
          />
          <ComboBox label="Asset" value={asset} setValue={setAsset} options={assets} placeholder="Search assets…" />
          <ComboBox label="SPV" value={spv} setValue={setSpv} options={spvs} placeholder="Search SPVs…" />
          <ComboBox
            label="Tenant"
            value={tenant}
            setValue={setTenant}
            options={tenants}
            placeholder={tenants.length ? 'Search tenants…' : 'Type a new tenant…'}
          />
          <label className="grid gap-1">
            <span className={LABEL_BASE}>
              Date <small className={HELP_TEXT}>{DATE_PLACEHOLDER}</small>
            </span>
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder={DATE_PLACEHOLDER}
              className={`${INPUT_BASE} ${dateError ? 'border-red-400 focus:ring-red-200' : ''}`}
            />
            {dateError && <p className="text-xs text-red-600 dark:text-red-400">{dateError}</p>}
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void runSearch(1)}
            disabled={loading}
            className={`inline-flex items-center justify-center ${TOKENS.radius} bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:translate-y-px disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900`}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button
            onClick={() => { setTypeDisplay(''); setAsset(''); setSpv(''); setTenant(''); setDate(''); setRows([]); setTotal(null); setPage(1) }}
            className={`${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-2 text-sm`}
          >
            Clear
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-neutral-600 dark:text-neutral-300">
                <tr>
                  <th className="px-3 py-2">Type (code)</th>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">SPV</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Document</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{r.type ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.asset ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.spv ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.tenant ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.doc_date ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs break-all">{r.name ?? filenameFromPath(r.storage_path)}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => void openSigned(r)}
                        disabled={signingId === r.id}
                        className={`inline-flex items-center justify-center ${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-1.5 text-xs`}
                      >
                        {signingId === r.id ? 'Opening…' : 'Open'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {total !== null && total > PAGE_SIZE && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <div className={TOKENS.subtext}>
                  {total} résultat{total > 1 ? 's' : ''} • Page {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={loading || page <= 1}
                    onClick={() => void runSearch(page - 1)}
                    className={`${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-1.5 disabled:opacity-50`}
                  >
                    Prev
                  </button>
                  <button
                    disabled={loading || (totalPages !== null && page >= totalPages)}
                    onClick={() => void runSearch(page + 1)}
                    className={`${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-1.5 disabled:opacity-50`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          !loading && <p className={TOKENS.subtext}>No result for now.</p>
        )}
      </section>
    </main>
  )
}

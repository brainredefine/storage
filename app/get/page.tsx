'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabaseClient'

/* ---------- UI tokens (aligned with Login page) ---------- */
const TOKENS = {
  radius: 'rounded',
  border: 'border border-gray-300',
  surface: 'bg-white',
  text: 'text-gray-700',
  subtext: 'text-gray-500',
  focus: 'focus:outline-none focus:ring-2 focus:ring-blue-500',
} as const

const INPUT_BASE = `w-full ${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-2 leading-tight ${TOKENS.text} placeholder:text-gray-400 ${TOKENS.focus}`
const LABEL_BASE = 'mb-2 block text-sm font-bold text-gray-700'
const HELP_TEXT = 'text-xs text-gray-500'
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
    if (!seen.has(k)) {
      seen.add(k)
      out.push(v)
    }
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
  label,
  value,
  setValue,
  options,
  placeholder = '',
  required = false,
  noResultsLabel = 'No results',
}: ComboBoxProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState<number>(-1)
  const listRef = useRef<HTMLUListElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const filtered = useFilter(options, value)
  const hasOptions = filtered.length > 0
  const listboxId = useMemo(() => `listbox-${Math.random().toString(36).slice(2)}`, [])

  function commitSelection(v: string) {
    setValue(v)
    setOpen(false)
    setHighlight(-1)
    inputRef.current?.focus()
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) setOpen(true)
    if (!hasOptions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % filtered.length)
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1))
    }
    if (e.key === 'Home') {
      e.preventDefault()
      setHighlight(0)
    }
    if (e.key === 'End') {
      e.preventDefault()
      setHighlight(filtered.length - 1)
    }
    if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      commitSelection(filtered[highlight]!)
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    }
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
    <div className="relative grid gap-1">
      <label className={LABEL_BASE}>
        {label}{' '}
        {required ? (
          <span className="text-red-500" aria-hidden>
            *
          </span>
        ) : (
          <small className={HELP_TEXT}>(optional)</small>
        )}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
            setHighlight(-1)
          }}
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
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-gray-500 hover:text-gray-700"
        >
          {value ? <span aria-hidden>&times;</span> : <span aria-hidden>▾</span>}
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded border border-gray-300 bg-white shadow-md">
            <ul ref={listRef} id={listboxId} role="listbox" className="max-h-60 overflow-auto py-1 outline-none">
              {hasOptions ? (
                filtered.map((opt, i) => (
                  <li
                    key={`${opt}-${i}`}
                    id={`${listboxId}-option-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === highlight}
                    className={`cursor-pointer px-3 py-2 text-sm ${
                      i === highlight ? 'bg-gray-100' : 'hover:bg-gray-50'
                    } text-gray-700`}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitSelection(opt)}
                  >
                    {opt}
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-gray-500">{noResultsLabel}</li>
              )}
            </ul>
          </div>
        )}
      </div>
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
      const { data: tpData } = await supabaseBrowser.from('type_paths').select('code, display_name').order('code', {
        ascending: true,
      })
      const tps = (tpData as ReadonlyArray<TypePathRow> | null) ?? []
      const map = new Map<string, string>()
      const opts: string[] = []
      for (const r of tps) {
        const disp = r.display_name?.trim() ?? ''
        const code = r.code?.trim() ?? ''
        if (!disp || !code) continue
        if (!map.has(disp)) {
          map.set(disp, code)
          opts.push(disp)
        }
      }
      opts.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      setTypeMap(map)
      setTypeOptions(opts)

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
      const { data: sData } = await supabaseBrowser.from('documents').select('spv').not('spv', 'is', null).order('spv', {
        ascending: true,
      })
      const listS = ((sData as ReadonlyArray<{ spv: string | null }> | null) ?? [])
        .map((r) => r.spv?.trim() ?? '')
        .filter((s) => s.length > 0)
      setSpvs(uniqCaseInsensitive(listS))
    })()
  }, [])

  // Tenants for selected asset
  useEffect(() => {
    if (!asset) {
      setTenants([])
      return
    }
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
      if (spv.trim().length > 0) q = q.eq('spv', spv.trim())
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
    <main className="min-h-screen bg-gray-100 p-6 flex items-start justify-center">
      <div className="w-full max-w-5xl">
        <div className="flex gap-2 justify-end">
          <Link
            href="/"
            className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-50"
          >
            Sections
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-center text-2xl font-bold text-gray-900">Documents</h1>
        </header>

        <section className="w-full rounded bg-white p-8 shadow-md grid gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
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

            <div className="grid gap-1">
              <label className={LABEL_BASE}>
                Date <small className={HELP_TEXT}>{DATE_PLACEHOLDER}</small>
              </label>
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder={DATE_PLACEHOLDER}
                className={`${INPUT_BASE} ${dateError ? 'border-red-400 focus:ring-red-200' : ''}`}
              />
              {dateError && <p className="mt-1 text-sm text-red-500">{dateError}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={() => void runSearch(1)}
              disabled={loading}
              className="w-full sm:w-auto rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Searching…' : 'Search'}
            </button>

            <button
              onClick={() => {
                setTypeDisplay('')
                setAsset('')
                setSpv('')
                setTenant('')
                setDate('')
                setRows([])
                setTotal(null)
                setPage(1)
              }}
              className="w-full sm:w-auto rounded border border-gray-300 bg-white px-4 py-2 font-bold text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-gray-700">
                <thead className="text-left text-gray-600">
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
                <tbody className="divide-y divide-gray-200">
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2">{r.type ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.asset ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.spv ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.tenant ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.doc_date ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className="break-all text-xs">{r.name ?? filenameFromPath(r.storage_path)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => void openSigned(r)}
                          disabled={signingId === r.id}
                          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {signingId === r.id ? 'Opening…' : 'Open'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {total !== null && total > PAGE_SIZE && (
                <div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-gray-500">
                    {total} résultat{total > 1 ? 's' : ''} • Page {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={loading || page <= 1}
                      onClick={() => void runSearch(page - 1)}
                      className="rounded border border-gray-300 bg-white px-3 py-1.5 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      disabled={loading || (totalPages !== null && page >= totalPages)}
                      onClick={() => void runSearch(page + 1)}
                      className="rounded border border-gray-300 bg-white px-3 py-1.5 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            !loading && <p className="text-gray-500">No result for now.</p>
          )}
        </section>
      </div>
    </main>
  )
}

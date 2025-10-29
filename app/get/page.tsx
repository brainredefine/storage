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
}
const INPUT_BASE = `w-full ${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-2 ${TOKENS.text} placeholder:text-neutral-400 ${TOKENS.focus}`
const LABEL_BASE = 'text-sm font-medium text-neutral-800 dark:text-neutral-100'
const HELP_TEXT = 'text-xs text-neutral-500 dark:text-neutral-400'
const DATE_PLACEHOLDER = 'YYYY or YYYY-MM or YYYY-MM-DD'

/* ---------- Types ---------- */
type DocRow = {
  id: string
  type: string | null
  storage_path: string
  asset: string | null
  tenant: string | null
  doc_date: string | null
  created_at: string
}

/* ---------- Helpers ---------- */
function uniqCaseInsensitive(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of arr) {
    const k = v.toLowerCase()
    if (!seen.has(k)) { seen.add(k); out.push(v) }
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function useFilter(options: string[], query: string): string[] {
  const q = (query || '').toLowerCase()
  return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 100)
}

function ComboBox({
  label, value, setValue, options, placeholder = '', required = false, noResultsLabel = 'No results',
}: {
  label: string
  value: string
  setValue: (s: string) => void
  options: string[]
  placeholder?: string
  required?: boolean
  noResultsLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
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
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % filtered.length) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1)) }
    if (e.key === 'Home')      { e.preventDefault(); setHighlight(0) }
    if (e.key === 'End')       { e.preventDefault(); setHighlight(filtered.length - 1) }
    if (e.key === 'Enter' && highlight >= 0) { e.preventDefault(); commitSelection(filtered[highlight]) }
    if (e.key === 'Escape')    { setOpen(false); setHighlight(-1) }
  }
  useEffect(() => {
    if (!listRef.current) return
    listRef.current
      .querySelector<HTMLElement>(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' })
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
        {required ? (
          <span className="text-red-600 dark:text-red-400" aria-hidden>*</span>
        ) : (
          <small className={HELP_TEXT}>(optional)</small>
        )}
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
                  key={opt}
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
function buildDateFilter(date: string) {
  if (!date || !DATE_FLEX.test(date)) return null
  const [yStr, mStr, dStr] = date.split('-')
  const y = Number(yStr)
  const m = mStr ? Number(mStr) : undefined
  const d = dStr ? Number(dStr) : undefined

  if (!m) {
    const from = `${y}-01-01`
    const to = `${y + 1}-01-01`
    return { from, to }
  }
  if (!d) {
    const from = `${y}-${String(m).padStart(2, '0')}-01`
    const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
    const to = `${next.y}-${String(next.m).padStart(2, '0')}-01`
    return { from, to }
  }
  const exact = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return { exact }
}

/* ---------- Page ---------- */
const PAGE_SIZE = 50

export default function Page() {
  // filters
  const [types, setTypes] = useState<string[]>([])
  const [assets, setAssets] = useState<string[]>([])
  const [tenants, setTenants] = useState<string[]>([])

  const [type, setType] = useState('')
  const [asset, setAsset] = useState('')
  const [tenant, setTenant] = useState('')
  const [date, setDate] = useState('')
  const dateError = date && !DATE_FLEX.test(date) ? 'Invalid format. Example: 2024 or 2024-09 or 2024-09-30' : ''

  // data
  const [rows, setRows] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [signingId, setSigningId] = useState<string | null>(null)

  // Populate Type & Asset directly from documents (client-side distinct)
  useEffect(() => {
    (async () => {
      // Types
      const { data: tData } = await supabaseBrowser
        .from('documents')
        .select('type')
        .not('type', 'is', null)
        .order('type', { ascending: true })
      if (tData) {
        const list = (tData as { type: string | null }[])
          .map(r => r.type?.trim() || '')
          .filter(Boolean)
        setTypes(uniqCaseInsensitive(list))
      } else {
        setTypes([])
      }

      // Assets
      const { data: aData } = await supabaseBrowser
        .from('documents')
        .select('asset')
        .not('asset', 'is', null)
        .order('asset', { ascending: true })
      if (aData) {
        const list = (aData as { asset: string | null }[])
          .map(r => r.asset?.trim() || '')
          .filter(Boolean)
        setAssets(uniqCaseInsensitive(list))
      } else {
        setAssets([])
      }
    })()
  }, [])

  // Tenants for selected asset (direct from documents)
  useEffect(() => {
    if (!asset) { setTenants([]); return }
    (async () => {
      const { data } = await supabaseBrowser
        .from('documents')
        .select('tenant')
        .eq('asset', asset)
        .not('tenant', 'is', null)
        .order('tenant', { ascending: true })
      if (data) {
        const list = (data as { tenant: string | null }[])
          .map(r => r.tenant?.trim() || '')
          .filter(Boolean)
        setTenants(uniqCaseInsensitive(list))
      } else {
        setTenants([])
      }
    })()
  }, [asset])

  async function runSearch(goToPage?: number) {
    setLoading(true); setError('')
    try {
      const pg = goToPage ?? 1
      const from = (pg - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let q = supabaseBrowser
        .from('documents')
        .select('id,type,storage_path,asset,tenant,doc_date,created_at', { count: 'exact' })
        .order('doc_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (type.trim()) q = q.ilike('type', type.trim())
      if (asset.trim()) q = q.eq('asset', asset.trim())
      if (tenant.trim()) q = q.eq('tenant', tenant.trim())

      const df = buildDateFilter(date.trim())
      if (df) {
        if ('exact' in df) q = q.eq('doc_date', df.exact)
        else q = q.gte('doc_date', df.from).lt('doc_date', df.to)
      }

      q = q.range(from, to)

      const { data, error: qErr, count } = await q
      if (qErr) throw qErr
      setRows((data || []) as DocRow[])
      setTotal(count ?? null)
      setPage(pg)
    } catch (e) {
      if (e instanceof Error) setError(e.message)
      else setError('Erreur lors de la récupération des documents.')
    } finally {
      setLoading(false)
    }
  }

  function totalPages() {
    if (total == null) return null
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }

  async function openSigned(r: DocRow) {
    try {
      setSigningId(r.id)
      const res = await fetch('/api/sign-download', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storage_path: r.storage_path, expiresIn: 3600 }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Signature échouée')
      window.open(j.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      // Feedback minimaliste, tu as déjà un toast/alert peut-être
      alert(e instanceof Error ? e.message : 'Impossible d’ouvrir le document')
    } finally {
      setSigningId(null)
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex justify-end gap-2">
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-50"
        >
          Upload
        </Link>
        <Link
          href="/account/password"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-50"
        >
          Change password
        </Link>
      </div>

      <header className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Documents</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Recherche par type / asset / tenant / date (source: documents).</p>
      </header>

      <section className={`grid gap-5 ${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} p-5 shadow-sm`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ComboBox label="Type" value={type} setValue={setType} options={types} placeholder={types.length ? 'Type to search types…' : 'Loading…'} />
          <ComboBox label="Asset" value={asset} setValue={setAsset} options={assets} placeholder="Type to search assets…" />
          <ComboBox label="Tenant" value={tenant} setValue={setTenant} options={tenants} placeholder={tenants.length ? 'Type to search tenants…' : 'Type a new tenant…'} />
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
            onClick={() => runSearch(1)}
            disabled={loading}
            className={`inline-flex items-center justify-center ${TOKENS.radius} bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:translate-y-px disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900`}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button
            onClick={() => { setType(''); setAsset(''); setTenant(''); setDate(''); setRows([]); setTotal(null); setPage(1) }}
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
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Path</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{r.type || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.asset || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.tenant || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.doc_date || '—'}</td>
                    <td className="px-3 py-2">
                      <code className="text-xs break-all">{r.storage_path}</code>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => openSigned(r)}
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
                    onClick={() => runSearch(page - 1)}
                    className={`${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-1.5 disabled:opacity-50`}
                  >
                    Prev
                  </button>
                  <button
                    disabled={loading || page >= Math.max(1, Math.ceil((total || 1) / PAGE_SIZE))}
                    onClick={() => runSearch(page + 1)}
                    className={`${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-1.5 disabled:opacity-50`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          !loading && <p className={TOKENS.subtext}>Aucun résultat pour l’instant.</p>
        )}
      </section>
    </main>
  )
}

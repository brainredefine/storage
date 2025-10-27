'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'
import Link from 'next/link'

// ========= Design tokens (neutral/mono, no blue) =========
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

// ========= Utils =========
const DATE_PLACEHOLDER = 'YYYY or YYYY-MM or YYYY-MM-DD'
const UPLOAD_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_UPLOAD_TIMEOUT_MS || 300000)
const TENANTS_SOURCE = process.env.NEXT_PUBLIC_TENANTS_SOURCE || 'folders'

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-')
}

function uniqCaseInsensitive(arr: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of arr) {
    const k = (v || '').toLowerCase()
    if (!seen.has(k)) { seen.add(k); out.push(v) }
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function previewFilename(o: {
  type?: string
  date?: string
  asset?: string
  tenant?: string
  suffix?: string
  file?: File | null
}) {
  if (!o.type || !o.file) return ''
  const ext = (o.file.name.split('.').pop() || '').toLowerCase()
  const parts: string[] = [o.type.toLowerCase()]
  if (o.date) parts.push(o.date)
  if (o.asset) parts.push(o.asset)
  if (o.tenant) parts.push(slugify(o.tenant))
  if (o.suffix) parts.push(slugify(o.suffix))
  return `${parts.join('_')}.${ext || 'pdf'}`
}

// ========= ComboBox (accessible, high-contrast, neutral) =========
function useFilter(options: string[], query: string) {
  const q = (query || '').toLowerCase()
  return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 100)
}

function ComboBox({
  label,
  value,
  setValue,
  options,
  placeholder = '',
  required = false,
  noResultsLabel = 'No results',
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
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % filtered.length); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1)); return }
    if (e.key === 'Home') { e.preventDefault(); setHighlight(0); return }
    if (e.key === 'End') { e.preventDefault(); setHighlight(filtered.length - 1); return }
    if (e.key === 'Enter' && highlight >= 0) { e.preventDefault(); commitSelection(filtered[highlight]); return }
    if (e.key === 'Escape') { setOpen(false); setHighlight(-1); return }
  }

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  // Close when clicking outside
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
        {label} {required ? <span className="text-red-600 dark:text-red-400" aria-hidden>*</span> : <small className={HELP_TEXT}>(optional)</small>}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); setHighlight(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-autocomplete="list"
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
          {value ? <span aria-hidden>&times;</span> : <span aria-hidden className="translate-y-[1px]">▾</span>}
        </button>
      </div>

      {open && (
        <div className={`absolute z-50 mt-1 w-full overflow-hidden ${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} shadow-lg`}>
          <ul ref={listRef} id={listboxId} role="listbox" className="max-h-60 overflow-auto py-1 outline-none">
            {hasOptions ? (
              filtered.map((opt, i) => (
                <li
                  id={`${listboxId}-option-${i}`}
                  key={opt}
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

// ========= Types =========
export type UploadType = {
  type: string
  requires_asset: boolean
  requires_tenant: boolean
  require_strict: boolean
  allow_keyword: boolean
  aliases: string[]
}

// ========= Page =========
export default function Page() {
  const [types, setTypes] = useState<UploadType[]>([])
  const [assets, setAssets] = useState<string[]>([])
  const [tenants, setTenants] = useState<string[]>([])

  const [type, setType] = useState('')
  const [date, setDate] = useState('')
  const [asset, setAsset] = useState('')
  const [tenant, setTenant] = useState('')
  const [suffix, setSuffix] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [dateError, setDateError] = useState<string>('')
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: t } = await supabaseBrowser.from('v_upload_types').select('*')
      const extended = [
        ...((t || []) as UploadType[]),
        { type: 'other', requires_asset: false, requires_tenant: false, require_strict: false, allow_keyword: false, aliases: [] },
      ]
      setTypes(extended)

      const { data: a } = await supabaseBrowser.from('v_upload_assets').select('asset').order('asset')
      setAssets((a || []).map((r: any) => r.asset))
    })()
  }, [])

  useEffect(() => {
    if (!asset) { setTenants([]); return }
    ;(async () => {
      if (TENANTS_SOURCE === 'folders') {
        const { data, error } = await supabaseBrowser
          .from('v_asset_tenants')
          .select('tenant')
          .eq('asset', asset)
          .order('tenant')
        if (error) { console.error(error); setTenants([]); return }
        setTenants(uniqCaseInsensitive((data || []).map((r: any) => r.tenant)))
      } else {
        const { data, error } = await supabaseBrowser
          .from('seed_asset_tenants')
          .select('tenant')
          .eq('asset', asset).order('tenant')
        if (error) { console.error(error); setTenants([]); return }
        setTenants(uniqCaseInsensitive((data || []).map((r: any) => r.tenant)))
      }
    })()
  }, [asset])

  const rules = useMemo(() => types.find((t) => t.type === type), [types, type])
  const isOther = type === 'other'
  const needsAsset = !!rules?.requires_asset && !isOther
  const needsTenant = !!rules?.requires_tenant && !isOther
  const isStrict = !!rules?.require_strict && !isOther

  const namePreview = useMemo(
    () => previewFilename({ type, date, asset, tenant, suffix, file }),
    [type, date, asset, tenant, suffix, file]
  )

  function abortUpload() { try { xhrRef.current?.abort() } catch {} }

  useEffect(() => {
    if (!date) { setDateError(''); return }
    const ok = /^\d{4}(-\d{2}(-\d{2})?)?$/.test(date)
    setDateError(ok ? '' : 'Invalid format. Example: 2024 or 2024-09 or 2024-09-30')
  }, [date])

  async function onUpload() {
    try {
      setStatus('')
      setLoading(true)
      setProgress(0)

      if (!file) throw new Error('Choose a file first')
      if (!type) throw new Error('Select a type')
      if (isStrict && !date) throw new Error('Date is required for this type')
      if (dateError) throw new Error(dateError)
      if (needsAsset && !asset) throw new Error('Asset is required')
      if (needsTenant && !tenant) throw new Error('Tenant is required')

      const res = await fetch('/api/sign-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type,
          date: date || undefined,
          asset: asset || undefined,
          tenant: tenant || undefined,
          suffix: suffix || undefined,
          originalFilename: file.name,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'sign failed')

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr
        xhr.open('PUT', j.signedUrl, true)
        xhr.timeout = UPLOAD_TIMEOUT_MS
        xhr.setRequestHeader('content-type', file.type || 'application/octet-stream')
        xhr.setRequestHeader('x-upsert', 'true')
        xhr.setRequestHeader('cache-control', 'max-age=3600')
        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return
          setProgress(Math.round((evt.loaded / evt.total) * 100))
        }
        xhr.onload = () => { xhr.status >= 200 && xhr.status < 300 ? (setProgress(100), resolve()) : reject(new Error(`upload failed (${xhr.status})`)) }
        xhr.onerror = () => reject(new Error('network error during upload'))
        xhr.ontimeout = () => reject(new Error('upload timeout'))
        xhr.onabort = () => reject(new Error('upload aborted'))
        xhr.send(file)
      })

      setStatus(`Uploaded ✅ → ${j.path}`)
    } catch (e: any) {
      setStatus(`Error: ${e?.message || 'Upload failed'}`)
    } finally {
      setLoading(false)
      xhrRef.current = null
    }
  }

  // ========= Layout (neutral DA) =========
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex justify-end">
  <Link
    href="/account/password"
    className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-50"
  >
    Change password
  </Link>
</div>

      <header className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Upload</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Neutral, high-contrast UI. No blues. Keyboard-friendly comboboxes.</p>
      </header>

      <section className={`grid gap-5 ${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} p-5 shadow-sm`}>
        {/* Type */}
        <label className="grid gap-1">
          <span className={LABEL_BASE}>Type *</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT_BASE}>
            <option value="">Select a type…</option>
            {types.map((t) => (
              <option key={t.type} value={t.type}>
                {t.type}
              </option>
            ))}
          </select>
        </label>

        {/* Disclaimer si Other */}
        {type === 'other' && (
          <div className={`text-sm ${TOKENS.radius} border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200`}>
            <strong>Note:</strong> Select this only if you don't find what you are looking for, and please write{' '}
            <a className="underline" href="mailto:gauthier@redefine.group">gauthier@redefine.group</a> to add the missing folders.
          </div>
        )}

        {/* Date */}
        <label className="grid gap-1">
          <span className={LABEL_BASE}>
            Date {isStrict ? '*' : <small className={HELP_TEXT}>(optional)</small>}{' '}
            <small className={HELP_TEXT}>{DATE_PLACEHOLDER}</small>
          </span>
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder={DATE_PLACEHOLDER}
            className={`${INPUT_BASE} ${dateError ? 'border-red-400 focus:ring-red-200' : ''}`}
          />
          {dateError && <p className="text-xs text-red-600 dark:text-red-400">{dateError}</p>}
        </label>

        {/* Asset */}
        {needsAsset && (
          <ComboBox
            label="Asset"
            required
            value={asset}
            setValue={setAsset}
            options={assets}
            placeholder="Type to search assets…"
          />
        )}

        {/* Tenant */}
        {needsTenant && (
          <ComboBox
            label="Tenant"
            required
            value={tenant}
            setValue={setTenant}
            options={tenants}
            placeholder={tenants.length ? 'Type to search tenants…' : 'Type a new tenant…'}
          />
        )}

        {/* Suffix optionnel */}
        <label className="grid gap-1">
          <span className={LABEL_BASE}>Optional suffix</span>
          <input value={suffix} onChange={(e) => setSuffix(e.target.value)} className={INPUT_BASE} placeholder="e.g. v2, signed, draft" />
        </label>

        {/* Fichier */}
        <label className="grid gap-1">
          <span className={LABEL_BASE}>File *</span>
          <input
            type="file"
            className="block w-full text-sm text-neutral-800 file:mr-4 file:rounded-xl file:border file:border-neutral-300 file:bg-neutral-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-neutral-100 dark:text-neutral-200 dark:file:border-neutral-700 dark:file:bg-neutral-800 dark:file:text-neutral-200 dark:hover:file:bg-neutral-700"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        {/* Preview */}
        {namePreview && (
          <p className="text-sm text-neutral-600 dark:text-neutral-300"><strong>Preview:</strong> {namePreview}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onUpload}
            disabled={loading}
            className={`inline-flex items-center justify-center ${TOKENS.radius} bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:translate-y-px disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900`}
          >
            {loading ? 'Uploading…' : 'Upload'}
          </button>
          {loading && (
            <button
              onClick={abortUpload}
              className={`${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800`}
            >
              Cancel
            </button>
          )}
        </div>

        {/* Progression */}
        {loading && (
          <div className="w-full">
            <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
              <div className="h-2 rounded-full bg-neutral-900 transition-all dark:bg-neutral-100" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{progress}%</div>
          </div>
        )}

        {/* Statut */}
        {status && <p className="text-sm text-neutral-700 dark:text-neutral-300">{status}</p>}
      </section>
    </main>
  )
}

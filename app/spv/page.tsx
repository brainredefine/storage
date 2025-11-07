'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabaseClient'
import { buildMetaFilename } from '@/lib/metaName'

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
const DATE_PLACEHOLDER = 'YYYY or YYYY-MM'
const UPLOAD_TIMEOUT_MS: number = Number(process.env.NEXT_PUBLIC_UPLOAD_TIMEOUT_MS ?? 300000)

/* ---------- Types ---------- */
type TypePathRow = { code: string; display_name: string }
type SpvRow = { spv: string | null }
type SignUploadResponse = { signedUrl: string; path: string } | { error: string }

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
function sanitizeSegmentKeepCase(s: string): string {
  return s.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').replace(/-+/g, '-')
}
function useFilter(options: readonly string[], query: string): string[] {
  const q = (query || '').toLowerCase()
  return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 100)
}
// "type_date_spv.ext" (extraction si Right Number Already)
const STRICT_RE = /^(\d+(?:\.\d+){0,20})_(\d{4}(?:-\d{2})?)_([A-Za-z0-9-]+)(?:_.+)?\.([A-Za-z0-9]+)$/i
function extractTypeFromFilename(name: string): string | null {
  const m = STRICT_RE.exec(name)
  if (m) return m[1] ?? null
  const base = name.replace(/\.[^.]+$/, '')
  const token = (base.split(' ')[0] || '').trim()
  return /^\d+(?:\.\d+){0,20}$/.test(token) ? token : null
}

/* ---------- Simple ComboBox ---------- */
type ComboBoxProps = {
  label: ReactNode
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
  const [open, setOpen] = useState<boolean>(false)
  const [highlight, setHighlight] = useState<number>(-1)
  const listRef = useRef<HTMLUListElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const filtered = useFilter(options, value)
  const hasOptions = filtered.length > 0
  const listboxId = useMemo(() => `listbox-${Math.random().toString(36).slice(2)}`, [])

  function commitSelection(v: string): void { setValue(v); setOpen(false); setHighlight(-1); inputRef.current?.focus() }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) setOpen(true)
    if (!hasOptions) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % filtered.length) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1)) }
    if (e.key === 'Home')      { e.preventDefault(); setHighlight(0) }
    if (e.key === 'End')       { e.preventDefault(); setHighlight(filtered.length - 1) }
    if (e.key === 'Enter' && highlight >= 0) { e.preventDefault(); commitSelection(filtered[highlight]!) }
    if (e.key === 'Escape')    { setOpen(false); setHighlight(-1) }
  }
  useEffect(() => {
    if (!listRef.current) return
    listRef.current.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlight])
  useEffect(() => {
    function onDocClick(e: MouseEvent): void {
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
        {required ? <span className="text-red-600 dark:text-red-400" aria-hidden>*</span> : null}
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

/* ---------- Page ---------- */
export default function Page() {
  const type_f = 'spv' as const

  // Email user (tmail)
  const [userEmail, setUserEmail] = useState<string>('')

  // Types
  const [typeDisplay, setTypeDisplay] = useState<string>('')
  const [typeOptions, setTypeOptions] = useState<string[]>([])
  const [typeMap, setTypeMap] = useState<Map<string, string>>(new Map())

  // SPV
  const [spvs, setSpvs] = useState<string[]>([])
  const [spv, setSpv] = useState<string>('')

  // Form
  const [date, setDate] = useState<string>('')            // optional
  const [typeName, setTypeName] = useState<string>('')    // required
  const [file, setFile] = useState<File | null>(null)

  // Right Number Already
  const [rightNumberAlready, setRightNumberAlready] = useState<boolean>(false)
  const [extractedType, setExtractedType] = useState<string | null>(null)

  // UX
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [dateError, setDateError] = useState<string>('')
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  // Get current user email for tmail
  useEffect(() => {
    void (async () => {
      const { data } = await supabaseBrowser.auth.getUser()
      setUserEmail(data.user?.email ?? '')
    })()
  }, [])

  // Load types & SPVs
  useEffect(() => {
    void (async () => {
      const { data: tpData } = await supabaseBrowser
        .from('type_paths')
        .select('code, display_name')
        .eq('type_f', type_f)
        .order('code', { ascending: true })

      const tps = (tpData as ReadonlyArray<TypePathRow> | null) ?? []
      const map = new Map<string, string>()
      const opts: string[] = []
      for (const r of tps) {
        const disp = (r.display_name ?? '').trim()
        const code = (r.code ?? '').trim()
        if (!disp || !code) continue
        if (!map.has(disp)) { map.set(disp, code); opts.push(disp) }
      }
      opts.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      setTypeMap(map); setTypeOptions(opts)

      const { data: spvRows } = await supabaseBrowser
        .from('spv')
        .select('spv')
        .order('spv', { ascending: true })

      const list = ((spvRows as ReadonlyArray<SpvRow> | null) ?? [])
        .map((r) => r.spv?.trim() ?? '')
        .filter((s) => s.length > 0)
      setSpvs(uniqCaseInsensitive(list))
    })()
  }, [])

  // Extract type when "Right Number Already"
  useEffect(() => {
    if (rightNumberAlready && file?.name) setExtractedType(extractTypeFromFilename(file.name))
    else setExtractedType(null)
  }, [rightNumberAlready, file])

  // Date validation (optional)
  useEffect(() => {
    if (!date) { setDateError(''); return }
    const ok = /^\d{4}(?:-\d{2})?$/.test(date)
    setDateError(ok ? '' : 'Invalid date. Example: 2025 or 2025-07')
  }, [date])

  function abortUpload(): void {
    try { xhrRef.current?.abort() } catch { /* no-op */ }
  }

  // META filename preview (m(ttype=…)(tspv=…)(tname=…)(tdate?=…)(tmail?=…)(tscope=spv).ext)
  const namePreview = useMemo<string>(() => {
    const code = rightNumberAlready ? (extractedType || '') : (typeMap.get(typeDisplay.trim() || '') ?? '')
    if (!code || !file) return ''
    const tags: Record<string, string> = {
      ttype: code,
      tspv: spv,
      tname: typeName ? sanitizeSegmentKeepCase(typeName) : '',
      tscope: type_f,
    }
    if (date) tags.tdate = date
    if (userEmail) tags.tmail = userEmail
    return buildMetaFilename(tags, file.name)
  }, [rightNumberAlready, extractedType, typeDisplay, typeMap, date, spv, typeName, file, userEmail])

  async function onUpload(): Promise<void> {
    try {
      setStatus(''); setLoading(true); setProgress(0)

      if (!file) throw new Error('Choose a file first')
      if (dateError) throw new Error(dateError)          // date optional, juste format si présent
      if (!spv) throw new Error('SPV is required')
      if (!typeName.trim()) throw new Error('Type name is required')

      let finalType = ''
      if (rightNumberAlready) {
        if (!extractedType) throw new Error('Could not detect type from filename')
        finalType = extractedType
      } else {
        const code = typeMap.get(typeDisplay.trim() || '') ?? ''
        if (!code) throw new Error('Select a type')
        finalType = code
      }

      const body: Record<string, unknown> = {
        type: finalType,
        spv,
        type_name: typeName,
        originalFilename: file.name,
        rightNumberAlready,
        type_f, // 'spv'
      }
      if (date) body['date'] = date
      if (userEmail) body['tmail'] = userEmail

      const res = await fetch('/api/sign-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = (await res.json().catch(() => ({}))) as SignUploadResponse
      if (!res.ok || !('signedUrl' in j)) throw new Error('error' in j ? j.error : 'sign failed')

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr
        xhr.open('PUT', j.signedUrl, true)
        xhr.timeout = UPLOAD_TIMEOUT_MS
        xhr.setRequestHeader('content-type', file.type || 'application/octet-stream')
        xhr.setRequestHeader('x-upsert', 'true')
        xhr.setRequestHeader('cache-control', 'max-age=3600')
        xhr.upload.onprogress = (evt: ProgressEvent<EventTarget>) => { if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100)) }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? (setProgress(100), resolve()) : reject(new Error(`upload failed (${xhr.status})`)))
        xhr.onerror = () => reject(new Error('network error during upload'))
        xhr.ontimeout = () => reject(new Error('upload timeout'))
        xhr.onabort = () => reject(new Error('upload aborted'))
        xhr.send(file)
      })

      setStatus(`Uploaded ✅ → ${'path' in j ? j.path : ''}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setStatus(`Error: ${msg}`)
    } finally {
      setLoading(false); xhrRef.current = null
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex gap-2 justify-end">
        <Link href="/" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-50">
          Sections
        </Link>
      </div>

      <header className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Upload (SPV)</h1>
      </header>

      <section className={`grid gap-5 ${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} p-5 shadow-sm`}>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={rightNumberAlready} onChange={(e) => setRightNumberAlready(e.target.checked)} />
          <span className={LABEL_BASE}>Right Number Already</span>
        </label>

        {rightNumberAlready ? (
          <label className="grid gap-1">
            <span className={LABEL_BASE}>Detected type (from filename)</span>
            <input value={extractedType || ''} readOnly className={`${INPUT_BASE} opacity-70`} placeholder="—" />
          </label>
        ) : (
          // 1) TYPE ★
          <ComboBox
            label="Type"
            value={typeDisplay}
            setValue={setTypeDisplay}
            options={typeOptions}
            placeholder={typeOptions.length ? 'Type to search…' : 'Loading…'}
            required
          />
        )}

        {/* 2) SPV ★ */}
        <ComboBox
          label="SPV"
          value={spv}
          setValue={setSpv}
          options={spvs}
          placeholder="Type to search SPVs…"
          required
        />

        {/* 3) TYPE NAME ★ */}
        <label className="grid gap-1">
          <span className={LABEL_BASE}>
            Type name <span className="text-red-600 dark:text-red-400" aria-hidden>*</span>
          </span>
          <input
            value={typeName}
            onChange={(e) => setTypeName(e.target.value)}
            className={INPUT_BASE}
            placeholder="e.g. Gesellschaftsvertrag"
          />
          <p className={HELP_TEXT}>If empty, upload is blocked.</p>
        </label>

        {/* 4) DATE (optionnelle) */}
        <label className="grid gap-1">
          <span className={LABEL_BASE}>Date</span>
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder={DATE_PLACEHOLDER}
            className={`${INPUT_BASE} ${dateError ? 'border-red-400 focus:ring-red-200' : ''}`}
          />
          {dateError && <p className="text-xs text-red-600 dark:text-red-400">{dateError}</p>}
        </label>

        {/* FILE */}
        <label className="grid gap-1">
          <span className={LABEL_BASE}>File</span>
          <input
            type="file"
            className="block w-full text-sm text-neutral-800 file:mr-4 file:rounded-xl file:border file:border-neutral-300 file:bg-neutral-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-neutral-100 dark:text-neutral-200 dark:file:border-neutral-700 dark:file:bg-neutral-800 dark:file:text-neutral-200 dark:hover$file:bg-neutral-700"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {namePreview && (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            <strong>Preview:</strong> {namePreview}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => void onUpload()}
            disabled={loading}
            className={`inline-flex items-center justify-center ${TOKENS.radius} bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:translate-y-px disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900`}
          >
            {loading ? 'Uploading…' : 'Upload'}
          </button>
          {loading && (
            <button
              onClick={abortUpload}
              className={`${TOKENS.radius} ${TOKENS.border} ${TOKENS.surface} px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-200`}
            >
              Cancel
            </button>
          )}
        </div>

        {loading && (
          <div className="w-full">
            <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
              <div className="h-2 rounded-full bg-neutral-900 transition-all dark:bg-neutral-100" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{progress}%</div>
          </div>
        )}

        {status && <p className="text-sm text-neutral-700 dark:text-neutral-300">{status}</p>}
      </section>
    </main>
  )
}

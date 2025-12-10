'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabaseClient'
import { buildMetaFilename } from '@/lib/metaName'

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
const DATE_PLACEHOLDER = 'YYYY-MM or YYYY-MM-DD'
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
    if (!seen.has(k)) {
      seen.add(k)
      out.push(v)
    }
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
  label,
  value,
  setValue,
  options,
  placeholder = '',
  required = false,
  noResultsLabel = 'No results',
}: ComboBoxProps) {
  const [open, setOpen] = useState<boolean>(false)
  const [highlight, setHighlight] = useState<number>(-1)
  const listRef = useRef<HTMLUListElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const filtered = useFilter(options, value)
  const hasOptions = filtered.length > 0
  const listboxId = useMemo(() => `listbox-${Math.random().toString(36).slice(2)}`, [])

  function commitSelection(v: string): void {
    setValue(v)
    setOpen(false)
    setHighlight(-1)
    inputRef.current?.focus()
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
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
    function onDocClick(e: MouseEvent): void {
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
        {required ? <span className="text-red-500" aria-hidden>*</span> : null}
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
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded border border-gray-300 bg-white shadow-md">
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
  const [date, setDate] = useState<string>('') // optional
  const [typeName, setTypeName] = useState<string>('') // required
  const [file, setFile] = useState<File | null>(null)

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
        if (!map.has(disp)) {
          map.set(disp, code)
          opts.push(disp)
        }
      }
      opts.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      setTypeMap(map)
      setTypeOptions(opts)

      const { data: spvRows } = await supabaseBrowser.from('spv').select('spv').order('spv', { ascending: true })

      const list = ((spvRows as ReadonlyArray<SpvRow> | null) ?? [])
        .map((r) => r.spv?.trim() ?? '')
        .filter((s) => s.length > 0)
      setSpvs(uniqCaseInsensitive(list))
    })()
  }, [])

  // Date validation (optional)
  useEffect(() => {
    if (!date) {
      setDateError('')
      return
    }
    const ok = /^\d{4}-\d{2}(?:-\d{2})?$/.test(date)
    setDateError(ok ? '' : 'Invalid date. Examples: 2025-07 or 2025-07-15')
  }, [date])

  function abortUpload(): void {
    try {
      xhrRef.current?.abort()
    } catch {
      /* no-op */
    }
  }

  // META filename preview (m(ttype=…)(tspv=…)(tname=…)(tdate?=…)(tmail?=…)(tscope=spv).ext)
  const namePreview = useMemo<string>(() => {
    const code = typeMap.get(typeDisplay.trim() || '') ?? ''
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
  }, [typeDisplay, typeMap, date, spv, typeName, file, userEmail])

  async function onUpload(): Promise<void> {
    try {
      setStatus('')
      setLoading(true)
      setProgress(0)

      if (!file) throw new Error('Choose a file first')
      if (dateError) throw new Error(dateError) // date optional, juste format si présent
      if (!spv) throw new Error('SPV is required')
      if (!typeName.trim()) throw new Error('Type name is required')

      const code = typeMap.get(typeDisplay.trim() || '') ?? ''
      if (!code) throw new Error('Select a type')

      const body: Record<string, unknown> = {
        type: code,
        spv,
        date,
        type_name: typeName,
        originalFilename: file.name,
        type_f, // 'spv'
      }
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
        xhr.upload.onprogress = (evt: ProgressEvent<EventTarget>) => {
          if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100))
        }
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? (setProgress(100), resolve())
            : reject(new Error(`upload failed (${xhr.status})`))
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
      setLoading(false)
      xhrRef.current = null
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 flex items-start justify-center">
      <div className="w-full max-w-2xl">
        <div className="flex gap-2 justify-end">
          <Link
            href="/"
            className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-50"
          >
            Sections
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-center text-2xl font-bold text-gray-900">Upload (SPV)</h1>
        </header>

        <section className="w-full rounded bg-white p-8 shadow-md grid gap-5">
          <ComboBox
            label="Type"
            value={typeDisplay}
            setValue={setTypeDisplay}
            options={typeOptions}
            placeholder={typeOptions.length ? 'Type to search…' : 'Loading…'}
            required
          />

          <ComboBox label="SPV" value={spv} setValue={setSpv} options={spvs} placeholder="Type to search SPVs…" required />

          <div>
            <label className={LABEL_BASE}>
              Type name <span className="text-red-500" aria-hidden>*</span>
            </label>
            <input
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              className={INPUT_BASE}
              placeholder="e.g. Gesellschaftsvertrag"
            />
            <p className={HELP_TEXT}>If empty, upload is blocked.</p>
          </div>

          <div>
            <label className={LABEL_BASE}>Date</label>
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder={DATE_PLACEHOLDER}
              className={`${INPUT_BASE} ${dateError ? 'border-red-400 focus:ring-red-200' : ''}`}
            />
            {dateError && <p className="mt-1 text-sm text-red-500">{dateError}</p>}
          </div>

          <div>
            <label className={LABEL_BASE}>File</label>
            <input
              type="file"
              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded file:border file:border-gray-300 file:bg-gray-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-gray-700 hover:file:bg-gray-100"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {namePreview && (
            <p className="text-sm text-gray-700">
              <strong>Preview:</strong> {namePreview}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void onUpload()}
              disabled={loading}
              className="w-full rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Uploading…' : 'Upload'}
            </button>

            {loading && (
              <button
                type="button"
                onClick={abortUpload}
                className="w-full rounded border border-gray-300 bg-white px-4 py-2 font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>

          {loading && (
            <div className="w-full">
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-2 text-sm text-gray-700">{progress}%</div>
            </div>
          )}

          {status && <p className="text-sm text-gray-700">{status}</p>}
        </section>
      </div>
    </main>
  )
}

'use client'

import Link from 'next/link'

export default function Page() {
  return (
    <main className="mx-auto max-w-md p-10 grid gap-6 text-neutral-900 dark:text-neutral-100">
      <h1 className="text-xl font-semibold">Sections</h1>

      <Link
        href="/asset"
        className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      >
        Asset Upload
      </Link>

      <Link
        href="/spv"
        className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      >
        SPV Upload
      </Link>

      <Link
        href="/fund"
        className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      >
        Fund Upload
      </Link>

      <Link
        href="/get"
        className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      >
        Document Browser
      </Link>
    </main>
  )
}

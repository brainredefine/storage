'use client';

import Link from 'next/link';

export default function Page() {
  const card =
    'inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-gray-200';

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans text-gray-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="bg-gray-900 pt-8 pb-8 px-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Sections</h1>
          <p className="text-gray-400 text-sm">Choose where you want to go</p>
        </div>

        {/* Content */}
        <div className="p-8 grid gap-4">
          <Link href="/asset" className={card}>
            Asset Upload
          </Link>

          <Link href="/spv" className={card}>
            SPV Upload
          </Link>

          <Link href="/fund" className={card}>
            Fund Upload
          </Link>

          <Link href="/get" className={card}>
            Document Browser
          </Link>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">© 2025 Redefine Asset & Property Management</p>
        </div>
      </div>
    </main>
  );
}

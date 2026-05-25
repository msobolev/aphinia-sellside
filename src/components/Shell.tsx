'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

const NAV = [
  { href: '/pitch', label: 'Pitch engine', icon: '⚡' },
  { href: '/deals', label: 'Deals', icon: '💰' },
  { href: '/events', label: 'Events', icon: '🎯' },
  { href: '/companies', label: 'Companies', icon: '🏢' },
  { href: '/contacts', label: 'Contacts', icon: '👥' },
  { href: '/humint', label: 'HUMINT', icon: '🎙️' },
]

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname()

  return (
    <div className="flex h-screen overflow-hidden">
      <nav className="w-52 shrink-0 border-r flex flex-col py-6 px-3 gap-1"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="px-3 mb-6">
          <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--accent)' }}>
            aphinia
          </span>
          <span className="text-xs block mt-0.5" style={{ color: 'var(--text-dim)' }}>
            sellside crm
          </span>
        </div>
        {NAV.map(n => {
          const active = path.startsWith(n.href)
          return (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
              style={{
                background: active ? 'var(--bg-hover)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
              }}>
              <span className="text-base">{n.icon}</span>
              {n.label}
            </Link>
          )
        })}
        <div className="mt-auto px-3">
          <Link href="/humint"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent-dim)', color: 'white' }}>
            + Quick note
          </Link>
        </div>
      </nav>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

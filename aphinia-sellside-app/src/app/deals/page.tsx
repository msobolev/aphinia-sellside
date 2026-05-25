'use client'
import Shell from '@/components/Shell'

export default function DealsPage() {
  return (
    <Shell>
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Deals</h1>
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Coming next session.</p>
      </div>
    </Shell>
  )
}

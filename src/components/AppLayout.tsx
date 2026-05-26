// src/components/AppLayout.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Dashboard',     icon: '📊' },
  { href: '/dispatch',   label: 'Dispatch',      icon: '✉️' },
  { href: '/deals',      label: 'Deal Pipeline', icon: '💰' },
  { href: '/events',     label: 'Events',        icon: '📅' },
  { href: '/companies',  label: 'Companies',     icon: '🏢' },
  { href: '/contacts',   label: 'Contacts',      icon: '👥' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [humintOpen, setHumintOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      <aside style={{
        width: 240, flexShrink: 0, background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex', flexDirection: 'column', padding: 'var(--space-5) 0',
      }}>
        <div style={{ padding: '0 var(--space-5) var(--space-6)', borderBottom: '1px solid var(--border-default)', marginBottom: 'var(--space-4)' }}>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Aphinia</h1>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 500 }}>Sellside CRM</span>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 var(--space-3)' }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)', fontWeight: active ? 600 : 500,
                color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                background: active ? 'var(--accent-soft)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.12s ease',
              }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '0 var(--space-3)', marginTop: 'auto' }}>
          <button onClick={() => setHumintOpen(true)} className="btn btn-primary"
            style={{ width: '100%', fontSize: 'var(--text-sm)', padding: '12px 16px' }}>
            + Quick Note
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto' }}>
        <OverdueFollowUpBanner />
        <div className="page-container">{children}</div>
      </main>

      {humintOpen && <HumintModal onClose={() => setHumintOpen(false)} />}
    </div>
  );
}

function OverdueFollowUpBanner() {
  const overdueCount = 0;
  if (overdueCount === 0) return null;
  return (
    <div className="alert-bar" style={{ margin: 'var(--space-4) var(--space-8) 0', borderRadius: 'var(--radius-md)' }}>
      <span style={{ fontSize: 20 }}>⚠️</span>
      <span><strong>{overdueCount} overdue follow-up{overdueCount > 1 ? 's' : ''}</strong> — deals or interactions need attention today.</span>
      <Link href="/deals?filter=overdue" style={{ marginLeft: 'auto', fontWeight: 600 }}>View all →</Link>
    </div>
  );
}

function HumintModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', width: '100%', maxWidth: 540, boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Quick Note</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Company</label>
            <input className="input" placeholder="Start typing company name…" />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Contact <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span></label>
            <input className="input" placeholder="Filter by company first…" />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Source</label>
            <select className="input select">
              <option value="">Select…</option>
              <option value="rsac">RSAC</option><option value="blackhat">Black Hat</option>
              <option value="cybermktgcon">CyberMktgCon</option><option value="dinner">Dinner</option>
              <option value="call">Call</option><option value="email">Email</option>
              <option value="linkedin">LinkedIn</option><option value="conference_other">Conference (Other)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Notes</label>
            <textarea className="input" rows={4} placeholder="What happened? Key takeaways, next steps…" style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Follow-up</label>
              <input className="input" placeholder="e.g. Send prospectus" />
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Follow-up date</label>
              <input className="input" type="date" />
            </div>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-2)' }}>Save Note</button>
        </div>
      </div>
    </div>
  );
}

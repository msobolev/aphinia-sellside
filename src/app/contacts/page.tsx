// src/app/contacts/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import type { ContactWarmth, ContactPersona } from '@/lib/supabase-types';
import { WARMTH_LABELS, WARMTH_COLORS, PERSONA_LABELS } from '@/lib/supabase-types';

const supabase = createClient();

const PERSONA_OPTIONS: ContactPersona[] = ['cmo_cro', 'field_marketing', 'demand_gen', 'events', 'channel_alliance', 'director_marketing', 'marketing_other', 'regional_sales'];
const WARMTH_OPTIONS: ContactWarmth[] = ['hot', 'warm', 'cool', 'cold', 'dni'];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [personaFilter, setPersonaFilter] = useState('');
  const [warmthFilter, setWarmthFilter] = useState('');
  const [sortField, setSortField] = useState('last_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const router = useRouter();

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('contacts')
      .select('*, company:companies(id, name, status)', { count: 'exact' })
      .order(sortField, { ascending: sortDir === 'asc' })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (personaFilter) query = query.eq('persona', personaFilter);
    if (warmthFilter) query = query.eq('warmth', warmthFilter);
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) console.error('Contacts fetch error:', error);
    if (data) setContacts(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [search, personaFilter, warmthFilter, sortField, sortDir, page]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sortArrow = (field: string) => sortField !== field ? '' : sortDir === 'asc' ? ' ↑' : ' ↓';

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="page-title">Contacts</h1>
        <p className="page-subtitle">{loading ? 'Loading…' : `${total.toLocaleString()} contacts`}</p>
      </div>

      <div className="filters-row" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ flex: '1 1 300px', maxWidth: 400 }}>
          <input className="input" placeholder="Search by name or email…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <select className="input select" style={{ width: 200 }} value={personaFilter}
          onChange={e => { setPersonaFilter(e.target.value); setPage(0); }}>
          <option value="">All Personas</option>
          {PERSONA_OPTIONS.map(p => <option key={p} value={p}>{PERSONA_LABELS[p]}</option>)}
        </select>
        <select className="input select" style={{ width: 160 }} value={warmthFilter}
          onChange={e => { setWarmthFilter(e.target.value); setPage(0); }}>
          <option value="">All Warmth</option>
          {WARMTH_OPTIONS.map(w => <option key={w} value={w}>{WARMTH_LABELS[w]}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('last_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>Name{sortArrow('last_name')}</th>
                <th>Company</th>
                <th>Title</th>
                <th onClick={() => handleSort('persona')} style={{ cursor: 'pointer', userSelect: 'none' }}>Persona{sortArrow('persona')}</th>
                <th onClick={() => handleSort('warmth')} style={{ cursor: 'pointer', userSelect: 'none' }}>Warmth{sortArrow('warmth')}</th>
                <th>Email</th>
                <th>Email Status</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(contact => {
                const wColor = WARMTH_COLORS[contact.warmth as ContactWarmth] || '#6b7280';
                return (
                  <tr key={contact.id} onClick={() => router.push(`/contacts/${contact.id}`)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—'}
                      </span>
                      {contact.seniority && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>{contact.seniority}</div>
                      )}
                    </td>
                    <td>
                      {contact.company ? (
                        <a href={`/companies/${contact.company.id}`} style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}
                          onClick={e => e.stopPropagation()}>{contact.company.name}</a>
                      ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: 220 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {contact.title || '—'}
                      </span>
                    </td>
                    <td>
                      {contact.persona ? <span className="badge badge-blue" style={{ fontSize: 'var(--text-xs)' }}>{PERSONA_LABELS[contact.persona as ContactPersona] || contact.persona}</span> : '—'}
                    </td>
                    <td><span className="badge" style={{ background: `${wColor}14`, color: wColor }}>{WARMTH_LABELS[contact.warmth] || contact.warmth}</span></td>
                    <td style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{contact.email || '—'}</td>
                    <td>
                      {contact.email_status === 'verified' && <span className="badge badge-green">Verified</span>}
                      {contact.email_status === 'bounced' && <span className="badge badge-red">Bounced</span>}
                      {contact.email_status === 'unknown' && <span className="badge badge-gray">Unknown</span>}
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {[contact.city, contact.state].filter(Boolean).join(', ') || '—'}
                    </td>
                  </tr>
                );
              })}
              {!loading && contacts.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-tertiary)' }}>No contacts match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-5)' }}>
        <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Page {page + 1} · {total.toLocaleString()} total</span>
        <button className="btn btn-secondary btn-sm" disabled={contacts.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}

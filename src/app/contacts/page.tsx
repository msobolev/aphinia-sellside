// src/app/contacts/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [showAdd, setShowAdd] = useState(false);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">{loading ? 'Loading…' : `${total.toLocaleString()} contacts`}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Contact</button>
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

      {showAdd && (
        <AddContactModal
          onClose={() => setShowAdd(false)}
          onCreated={(id) => router.push(`/contacts/${id}`)}
        />
      )}
    </div>
  );
}

// ─────────────────────────  Add Contact modal  ─────────────────────────
interface CompanyOption { id: string; name: string }

function AddContactModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState<Record<string, string>>({
    first_name: '', last_name: '', email: '', title: '',
    persona: '', warmth: 'cold', phone: '', linkedin: '', city: '', state: '',
  });
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyLabel, setCompanyLabel] = useState('');
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResults, setCompanyResults] = useState<CompanyOption[]>([]);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // Debounced company search
  useEffect(() => {
    if (companyId) return; // already picked
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!companyQuery.trim()) { setCompanyResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', `%${companyQuery}%`)
        .order('name', { ascending: true })
        .limit(8);
      setCompanyResults((data as CompanyOption[]) || []);
      setCompanyOpen(true);
    }, 250);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [companyQuery, companyId]);

  function pickCompany(c: CompanyOption) {
    setCompanyId(c.id);
    setCompanyLabel(c.name);
    setCompanyOpen(false);
    setCompanyResults([]);
  }
  function clearCompany() {
    setCompanyId(null);
    setCompanyLabel('');
    setCompanyQuery('');
  }

  async function handleCreate() {
    setError('');
    if (!form.first_name.trim() && !form.last_name.trim()) {
      setError('Add at least a first or last name.');
      return;
    }
    setSaving(true);
    const payload: Record<string, any> = {
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      title: form.title.trim() || null,
      persona: form.persona || null,
      warmth: form.warmth || 'cold',
      phone: form.phone.trim() || null,
      linkedin: form.linkedin.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      email_status: 'unknown',
      company_id: companyId,
    };
    const { data, error: insErr } = await supabase
      .from('contacts')
      .insert(payload)
      .select('id')
      .single();
    setSaving(false);
    if (insErr) {
      setError(insErr.message || 'Could not create contact.');
      return;
    }
    if (data?.id) onCreated(data.id);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Contact</h2>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4, fontSize: 20 }}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div>
              <label className="field-label">First name</label>
              <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} autoFocus />
            </div>
            <div>
              <label className="field-label">Last name</label>
              <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>

            <div className="full">
              <label className="field-label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@company.com" />
            </div>

            {/* Company typeahead */}
            <div className="full" style={{ position: 'relative' }}>
              <label className="field-label">Company</label>
              {companyId ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="badge badge-blue" style={{ fontSize: 'var(--text-sm)' }}>{companyLabel}</span>
                  <button className="btn btn-ghost btn-sm" onClick={clearCompany}>Change</button>
                </div>
              ) : (
                <>
                  <input
                    className="input"
                    placeholder="Search companies…"
                    value={companyQuery}
                    onChange={e => setCompanyQuery(e.target.value)}
                    onFocus={() => companyResults.length && setCompanyOpen(true)}
                  />
                  {companyOpen && companyResults.length > 0 && (
                    <div style={{
                      position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 5,
                      background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', marginTop: 4,
                      maxHeight: 220, overflowY: 'auto',
                    }}>
                      {companyResults.map(c => (
                        <button key={c.id} onClick={() => pickCompany(c)} style={{
                          display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
                        }}>{c.name}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="full">
              <label className="field-label">Title</label>
              <input className="input" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>

            <div>
              <label className="field-label">Persona</label>
              <select className="input select" value={form.persona} onChange={e => set('persona', e.target.value)}>
                <option value="">— None —</option>
                {PERSONA_OPTIONS.map(p => <option key={p} value={p}>{PERSONA_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Warmth</label>
              <select className="input select" value={form.warmth} onChange={e => set('warmth', e.target.value)}>
                {WARMTH_OPTIONS.map(w => <option key={w} value={w}>{WARMTH_LABELS[w]}</option>)}
              </select>
            </div>

            <div>
              <label className="field-label">Phone</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="field-label">LinkedIn</label>
              <input className="input" value={form.linkedin} onChange={e => set('linkedin', e.target.value)} />
            </div>
            <div>
              <label className="field-label">City</label>
              <input className="input" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className="field-label">State</label>
              <input className="input" value={form.state} onChange={e => set('state', e.target.value)} />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid var(--red)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

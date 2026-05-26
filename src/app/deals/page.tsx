// src/app/deals/page.tsx
// Deal Pipeline — Kanban + List view with Create/Edit modal
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import { DEAL_STATUS_LABELS } from '@/lib/supabase-types';

const supabase = createClient();

interface Deal {
  id: string;
  company_id: string;
  contact_id: string | null;
  event_id: string | null;
  amount: number | null;
  status: string;
  sent_date: string | null;
  signed_date: string | null;
  invoice_date: string | null;
  paid_date: string | null;
  follow_up: string | null;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  companies: { name: string } | null;
  contacts: { first_name: string; last_name: string } | null;
  events: { name: string; event_date: string | null } | null;
}

interface CompanyOption { id: string; name: string }
interface ContactOption { id: string; first_name: string; last_name: string }
interface EventOption { id: string; name: string }

const STAGES = ['draft', 'prop_sent', 'prop_signed', 'invoice_sent', 'invoice_paid', 'closed_lost'];
const ACTIVE_STAGES = ['draft', 'prop_sent', 'prop_signed'];
const STAGE_COLOR: Record<string, string> = {
  draft: 'var(--yellow)',
  prop_sent: 'var(--accent)',
  prop_signed: 'var(--green)',
  invoice_sent: 'var(--purple)',
  invoice_paid: 'var(--green)',
  closed_lost: 'var(--red)',
};
const STAGE_BADGE: Record<string, string> = {
  draft: 'badge-yellow',
  prop_sent: 'badge-blue',
  prop_signed: 'badge-green',
  invoice_sent: 'badge-purple',
  invoice_paid: 'badge-green',
  closed_lost: 'badge-red',
};

const EMPTY_FORM = {
  company_id: '',
  company_search: '',
  contact_id: '',
  event_id: '',
  amount: 15000,
  status: 'draft',
  sent_date: '',
  follow_up: '',
  follow_up_date: '',
  notes: '',
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [companySuggestions, setCompanySuggestions] = useState<CompanyOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadDeals = useCallback(async () => {
    const { data } = await supabase
      .from('deals')
      .select('*, companies(name), contacts(first_name, last_name), events(name, event_date)')
      .order('created_at', { ascending: false });
    setDeals((data as unknown as Deal[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  useEffect(() => {
    async function loadEvents() {
      const { data } = await supabase.from('events').select('id, name').order('event_date', { ascending: true });
      setEvents((data || []) as EventOption[]);
    }
    loadEvents();
  }, []);

  // Company typeahead
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (form.company_search.length < 2) { setCompanySuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', `%${form.company_search}%`)
        .limit(8);
      setCompanySuggestions((data || []) as CompanyOption[]);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [form.company_search]);

  // Load contacts when company changes
  useEffect(() => {
    if (!form.company_id) { setContacts([]); return; }
    async function loadContacts() {
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .eq('company_id', form.company_id)
        .order('last_name');
      setContacts((data || []) as ContactOption[]);
    }
    loadContacts();
  }, [form.company_id]);

  const dealsByStage = ACTIVE_STAGES.reduce((acc, s) => {
    acc[s] = deals.filter(d => d.status === s);
    return acc;
  }, {} as Record<string, Deal[]>);

  const openPipeline = deals
    .filter(d => !['invoice_paid', 'closed_lost'].includes(d.status))
    .reduce((sum, d) => sum + (d.amount || 0), 0);

  const today = new Date().toISOString().slice(0, 10);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(deal: Deal) {
    setEditingId(deal.id);
    setForm({
      company_id: deal.company_id || '',
      company_search: deal.companies?.name || '',
      contact_id: deal.contact_id || '',
      event_id: deal.event_id || '',
      amount: deal.amount || 0,
      status: deal.status || 'draft',
      sent_date: deal.sent_date || '',
      follow_up: deal.follow_up || '',
      follow_up_date: deal.follow_up_date || '',
      notes: deal.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.company_id) return;
    setSaving(true);

    const payload = {
      company_id: form.company_id,
      contact_id: form.contact_id || null,
      event_id: form.event_id || null,
      amount: form.amount,
      status: form.status,
      sent_date: form.sent_date || null,
      follow_up: form.follow_up.trim() || null,
      follow_up_date: form.follow_up_date || null,
      notes: form.notes.trim() || null,
    };

    if (editingId) {
      await supabase.from('deals').update(payload).eq('id', editingId);
      showToast('Deal updated');
    } else {
      await supabase.from('deals').insert(payload);
      showToast('Deal created');
    }

    setSaving(false);
    setModalOpen(false);
    loadDeals();
  }

  async function handleDelete() {
    if (!editingId) return;
    if (!confirm('Delete this deal? This cannot be undone.')) return;
    await supabase.from('deals').delete().eq('id', editingId);
    showToast('Deal deleted');
    setModalOpen(false);
    loadDeals();
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  function updateForm(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function selectCompany(c: CompanyOption) {
    setForm(prev => ({ ...prev, company_id: c.id, company_search: c.name, contact_id: '' }));
    setCompanySuggestions([]);
  }

  function contactName(c: Deal['contacts']) {
    if (!c) return '—';
    return [c.first_name, c.last_name].filter(Boolean).join(' ');
  }

  function daysSince(dateStr: string | null) {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title">Deal Pipeline</h1>
          <p className="page-subtitle">
            {deals.length} deals · ${openPipeline.toLocaleString()} open pipeline
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 2 }}>
            <button className={`btn btn-sm ${view === 'kanban' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('kanban')}>Board</button>
            <button className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('list')}>List</button>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ New Deal</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : deals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <div style={{ fontSize: 40, marginBottom: 'var(--space-3)' }}>💰</div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>No deals yet</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>Create your first deal to start tracking your pipeline.</div>
          <button className="btn btn-primary" onClick={openCreate}>+ Create First Deal</button>
        </div>
      ) : view === 'kanban' ? (
        <div className="kanban-board">
          {ACTIVE_STAGES.map(stg => {
            const stgDeals = dealsByStage[stg] || [];
            const stgTotal = stgDeals.reduce((s, d) => s + (d.amount || 0), 0);
            return (
              <div key={stg} className="kanban-column">
                <div className="kanban-column-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: STAGE_COLOR[stg] }} />
                    <span className="kanban-column-title">{DEAL_STATUS_LABELS[stg] || stg}</span>
                  </span>
                  <span className="kanban-count">{stgDeals.length} · ${stgTotal.toLocaleString()}</span>
                </div>
                {stgDeals.map(deal => {
                  const isOverdue = deal.follow_up_date && deal.follow_up_date < today;
                  const age = daysSince(deal.sent_date);
                  return (
                    <div key={deal.id} className={`kanban-card ${isOverdue ? 'overdue' : ''}`} onClick={() => openEdit(deal)}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 6 }}>
                        {deal.companies?.name || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {deal.events?.name || 'No event'} · {contactName(deal.contacts)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                          ${(deal.amount || 0).toLocaleString()}
                        </span>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                          {age != null && age > 0 && (
                            <span className={`badge ${age > 14 ? 'badge-red' : age > 7 ? 'badge-yellow' : 'badge-gray'}`}>
                              {age}d
                            </span>
                          )}
                          {deal.follow_up_date && (
                            <span style={{
                              fontSize: 'var(--text-xs)',
                              color: isOverdue ? 'var(--red)' : 'var(--text-tertiary)',
                              fontWeight: isOverdue ? 600 : 400,
                            }}>
                              {isOverdue ? '⚠️ ' : ''}F/U {new Date(deal.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Event</th>
                  <th>Contact</th>
                  <th>Stage</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Age</th>
                  <th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {deals.map(deal => {
                  const isOverdue = deal.follow_up_date && deal.follow_up_date < today && !['invoice_paid', 'closed_lost'].includes(deal.status);
                  const age = daysSince(deal.sent_date);
                  return (
                    <tr key={deal.id} onClick={() => openEdit(deal)}>
                      <td style={{ fontWeight: 600 }}>{deal.companies?.name || 'Unknown'}</td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{deal.events?.name || '—'}</td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{contactName(deal.contacts)}</td>
                      <td><span className={`badge ${STAGE_BADGE[deal.status] || 'badge-gray'}`}>{DEAL_STATUS_LABELS[deal.status] || deal.status}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${(deal.amount || 0).toLocaleString()}</td>
                      <td>
                        {age != null && age > 0 ? (
                          <span className={`badge ${age > 14 ? 'badge-red' : age > 7 ? 'badge-yellow' : 'badge-gray'}`}>{age}d</span>
                        ) : '—'}
                      </td>
                      <td style={{ color: isOverdue ? 'var(--red)' : 'var(--text-secondary)', fontWeight: isOverdue ? 600 : 400, fontSize: 'var(--text-sm)' }}>
                        {deal.follow_up_date
                          ? `${isOverdue ? '⚠️ ' : ''}${new Date(deal.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', width: '100%', maxWidth: 620, boxShadow: 'var(--shadow-xl)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{editingId ? 'Edit Deal' : 'New Deal'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              {/* Company search */}
              <div style={{ gridColumn: '1 / -1', position: 'relative' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Company *</label>
                <input className="input" placeholder="Search company…" value={form.company_search}
                  onChange={e => { updateForm('company_search', e.target.value); updateForm('company_id', ''); }} />
                {form.company_id && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--green)', marginTop: 4, fontWeight: 500 }}>✓ {form.company_search}</div>
                )}
                {companySuggestions.length > 0 && !form.company_id && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                    {companySuggestions.map(c => (
                      <div key={c.id} style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
                        onMouseDown={() => selectCompany(c)}>{c.name}</div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Event</label>
                <select className="input select" value={form.event_id} onChange={e => updateForm('event_id', e.target.value)}>
                  <option value="">— Select event —</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Contact</label>
                <select className="input select" value={form.contact_id} onChange={e => updateForm('contact_id', e.target.value)}>
                  <option value="">— Select contact —</option>
                  {contacts.map(ct => <option key={ct.id} value={ct.id}>{ct.first_name} {ct.last_name}</option>)}
                </select>
                {!form.company_id && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>Select a company first</div>}
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Stage</label>
                <select className="input select" value={form.status} onChange={e => updateForm('status', e.target.value)}>
                  {STAGES.map(s => <option key={s} value={s}>{DEAL_STATUS_LABELS[s] || s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Amount ($)</label>
                <input className="input" type="number" min="0" step="1000" value={form.amount} onChange={e => updateForm('amount', parseInt(e.target.value) || 0)} />
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Date Sent</label>
                <input className="input" type="date" value={form.sent_date} onChange={e => updateForm('sent_date', e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Follow-up Date</label>
                <input className="input" type="date" value={form.follow_up_date} onChange={e => updateForm('follow_up_date', e.target.value)} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Follow-up Note</label>
                <input className="input" value={form.follow_up} onChange={e => updateForm('follow_up', e.target.value)} placeholder="e.g. Send revised proposal" />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Notes</label>
                <textarea className="input" placeholder="Deal context, negotiation notes…" value={form.notes}
                  onChange={e => updateForm('notes', e.target.value)} rows={3} style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-6)' }}>
              <div>
                {editingId && (
                  <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete Deal</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!form.company_id || saving}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Deal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--text-primary)', color: 'var(--text-inverse)', padding: '12px 24px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 600, boxShadow: 'var(--shadow-lg)', zIndex: 1000 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

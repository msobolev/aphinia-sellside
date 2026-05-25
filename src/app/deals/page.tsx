// src/app/deals/page.tsx
// Deal Pipeline with Create/Edit modal (Step 5)
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

interface Deal {
  id: string;
  company_id: string;
  contact_id: string;
  event_id: string;
  amount: number;
  stage: string;
  probability: number | null;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  companies: { name: string } | null;
  contacts: { name: string } | null;
  events: { name: string } | null;
}

interface CompanyOption { id: string; name: string; }
interface ContactOption { id: string; name: string; }
interface EventOption { id: string; name: string; }

const STAGES = ['draft', 'prop_sent', 'prop_signed'];
const STAGE_LABELS: Record<string, string> = {
  draft: 'Draft',
  prop_sent: 'Proposal Sent',
  prop_signed: 'Signed',
};
const STAGE_COLOR: Record<string, string> = {
  draft: 'var(--yellow)',
  prop_sent: 'var(--blue)',
  prop_signed: 'var(--green)',
};

const EMPTY_FORM = {
  company_id: '',
  company_search: '',
  contact_id: '',
  event_id: '',
  amount: 15000,
  stage: 'draft',
  probability: 50,
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

  // Company search
  const [companySuggestions, setCompanySuggestions] = useState<CompanyOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);

  const supabase = createClient();
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadDeals = useCallback(async () => {
    const { data } = await supabase
      .from('deals')
      .select('*, companies(name), contacts(name), events(name)')
      .order('created_at', { ascending: false });
    setDeals((data as unknown as Deal[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  // Load events once for the dropdown
  useEffect(() => {
    async function loadEvents() {
      const { data } = await supabase.from('events').select('id, name').order('date', { ascending: true });
      setEvents((data || []) as EventOption[]);
    }
    loadEvents();
  }, [supabase]);

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
  }, [form.company_search, supabase]);

  // Load contacts when company changes
  useEffect(() => {
    if (!form.company_id) { setContacts([]); return; }
    async function loadContacts() {
      const { data } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('company_id', form.company_id)
        .order('name');
      setContacts((data || []) as ContactOption[]);
    }
    loadContacts();
  }, [form.company_id, supabase]);

  const dealsByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = deals.filter(d => d.stage === stage);
    return acc;
  }, {} as Record<string, Deal[]>);

  const totalPipeline = deals.reduce((sum, d) => sum + (d.amount || 0), 0);
  const openPipeline = deals
    .filter(d => d.stage !== 'prop_signed')
    .reduce((sum, d) => sum + (d.amount || 0), 0);
  const weightedPipeline = deals
    .filter(d => d.stage !== 'prop_signed')
    .reduce((sum, d) => sum + (d.amount || 0) * ((d.probability || 50) / 100), 0);

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
      stage: deal.stage || 'draft',
      probability: deal.probability ?? 50,
      follow_up_date: deal.follow_up_date || '',
      notes: deal.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.company_id || !form.event_id) return;
    setSaving(true);

    const payload = {
      company_id: form.company_id,
      contact_id: form.contact_id || null,
      event_id: form.event_id,
      amount: form.amount,
      stage: form.stage,
      probability: form.probability,
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

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-title">Deal Pipeline</h1>
          <p className="page-subtitle">
            {deals.length} deals · ${openPipeline.toLocaleString()} open · ${Math.round(weightedPipeline).toLocaleString()} weighted
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
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
      ) : deals.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">💰</div>
              <div className="empty-state-title">No deals yet</div>
              <div className="empty-state-text">Create your first deal to start tracking your pipeline.</div>
              <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={openCreate}>
                + Create First Deal
              </button>
            </div>
          </div>
        </div>
      ) : view === 'kanban' ? (
        /* ── Kanban View ── */
        <div className="kanban-board">
          {STAGES.map(stage => {
            const stageDeals = dealsByStage[stage] || [];
            const stageTotal = stageDeals.reduce((s, d) => s + (d.amount || 0), 0);
            return (
              <div key={stage} className="kanban-column">
                <div className="kanban-column-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: STAGE_COLOR[stage] }} />
                    {STAGE_LABELS[stage]}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {stageDeals.length} · ${stageTotal.toLocaleString()}
                  </span>
                </div>
                {stageDeals.map(deal => {
                  const isOverdue = deal.follow_up_date && deal.follow_up_date < today && deal.stage !== 'prop_signed';
                  return (
                    <div
                      key={deal.id}
                      className="kanban-card"
                      onClick={() => openEdit(deal)}
                      style={{
                        borderLeft: isOverdue ? '3px solid var(--red)' : undefined,
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 6 }}>
                        {deal.companies?.name || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {deal.events?.name || 'No event'} · {deal.contacts?.name || 'No contact'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                          ${(deal.amount || 0).toLocaleString()}
                        </span>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                          {deal.probability != null && (
                            <span className="badge badge-neutral">{deal.probability}%</span>
                          )}
                          {deal.follow_up_date && (
                            <span style={{
                              fontSize: 'var(--text-xs)',
                              color: isOverdue ? 'var(--red)' : 'var(--text-tertiary)',
                              fontWeight: isOverdue ? 600 : 400,
                            }}>
                              F/U: {new Date(deal.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
        /* ── List View ── */
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Event</th>
                <th>Contact</th>
                <th>Stage</th>
                <th>Amount</th>
                <th>Probability</th>
                <th>Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {deals.map(deal => {
                const isOverdue = deal.follow_up_date && deal.follow_up_date < today && deal.stage !== 'prop_signed';
                return (
                  <tr key={deal.id} onClick={() => openEdit(deal)}>
                    <td style={{ fontWeight: 600 }}>{deal.companies?.name || 'Unknown'}</td>
                    <td>{deal.events?.name || '—'}</td>
                    <td>{deal.contacts?.name || '—'}</td>
                    <td>
                      <span className={`badge ${
                        deal.stage === 'prop_signed' ? 'badge-green' :
                        deal.stage === 'prop_sent' ? 'badge-blue' : 'badge-yellow'
                      }`}>
                        {STAGE_LABELS[deal.stage] || deal.stage}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>${(deal.amount || 0).toLocaleString()}</td>
                    <td>{deal.probability != null ? `${deal.probability}%` : '—'}</td>
                    <td style={{
                      color: isOverdue ? 'var(--red)' : 'var(--text-secondary)',
                      fontWeight: isOverdue ? 600 : 400,
                    }}>
                      {deal.follow_up_date
                        ? new Date(deal.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Deal' : 'New Deal'}</h2>
              <button className="btn-ghost" onClick={() => setModalOpen(false)} style={{ padding: 4, fontSize: 20 }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>

                {/* Company search */}
                <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }}>
                  <label className="label">Company *</label>
                  <input
                    className="input"
                    placeholder="Search company..."
                    value={form.company_search}
                    onChange={e => {
                      updateForm('company_search', e.target.value);
                      updateForm('company_id', '');
                    }}
                  />
                  {form.company_id && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--green)', marginTop: 4, fontWeight: 500 }}>
                      ✓ {form.company_search}
                    </div>
                  )}
                  {companySuggestions.length > 0 && !form.company_id && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                      background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
                      maxHeight: 200, overflowY: 'auto', marginTop: 4,
                    }}>
                      {companySuggestions.map(c => (
                        <div key={c.id} style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
                          onMouseDown={() => selectCompany(c)}
                        >
                          {c.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Event */}
                <div className="form-group">
                  <label className="label">Event *</label>
                  <select className="select" value={form.event_id} onChange={e => updateForm('event_id', e.target.value)}>
                    <option value="">— Select event —</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
                </div>

                {/* Contact */}
                <div className="form-group">
                  <label className="label">Contact</label>
                  <select className="select" value={form.contact_id} onChange={e => updateForm('contact_id', e.target.value)}>
                    <option value="">— Select contact —</option>
                    {contacts.map(ct => (
                      <option key={ct.id} value={ct.id}>{ct.name}</option>
                    ))}
                  </select>
                  {!form.company_id && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                      Select a company first
                    </div>
                  )}
                </div>

                {/* Stage */}
                <div className="form-group">
                  <label className="label">Stage</label>
                  <select className="select" value={form.stage} onChange={e => updateForm('stage', e.target.value)}>
                    {STAGES.map(s => (
                      <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="form-group">
                  <label className="label">Amount ($)</label>
                  <input className="input" type="number" min="0" step="1000" value={form.amount} onChange={e => updateForm('amount', parseInt(e.target.value) || 0)} />
                </div>

                {/* Probability */}
                <div className="form-group">
                  <label className="label">Probability (%)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <input
                      style={{ flex: 1 }}
                      type="range" min="0" max="100" step="5"
                      value={form.probability}
                      onChange={e => updateForm('probability', parseInt(e.target.value))}
                    />
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', minWidth: 40, textAlign: 'right' }}>
                      {form.probability}%
                    </span>
                  </div>
                </div>

                {/* Follow-up date */}
                <div className="form-group">
                  <label className="label">Follow-up Date</label>
                  <input className="input" type="date" value={form.follow_up_date} onChange={e => updateForm('follow_up_date', e.target.value)} />
                </div>

                {/* Notes */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Notes</label>
                  <textarea
                    className="input textarea"
                    placeholder="Deal context, negotiation notes..."
                    value={form.notes}
                    onChange={e => updateForm('notes', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div>
                {editingId && (
                  <button className="btn" style={{ color: 'var(--red)' }} onClick={handleDelete}>
                    Delete Deal
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={!form.company_id || !form.event_id || saving}
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Deal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

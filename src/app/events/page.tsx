// src/app/events/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';

interface EventRow {
  id: string;
  name: string;
  event_date: string;
  city: string;
  format: string;
  max_sponsors: number;
  price_per_slot: number;
  sponsor_model: string;
  revenue_target: number;
  revenue_booked: number;
  conference_association: string | null;
  sponsor_count: number;
}

const EMPTY_FORM = {
  name: '',
  event_date: '',
  city: '',
  format: 'dinner',
  max_sponsors: 2,
  price_per_slot: 15000,
  sponsor_model: 'co_sponsor',
  revenue_target: 30000,
  conference_association: '',
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const supabase = createClient();

  const loadEvents = useCallback(async () => {
    const [eventsRes, sponsorRes] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: true }),
      supabase.from('event_sponsors').select('event_id'),
    ]);

    const countMap: Record<string, number> = {};
    (sponsorRes.data || []).forEach((s: { event_id: string }) => {
      countMap[s.event_id] = (countMap[s.event_id] || 0) + 1;
    });

    const enriched = (eventsRes.data || []).map((e: Record<string, unknown>) => ({
      ...e,
      sponsor_count: countMap[e.id as string] || 0,
    })) as unknown as EventRow[];

    setEvents(enriched);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = events.filter(e => {
    if (filter === 'upcoming') return e.event_date >= today;
    if (filter === 'past') return e.event_date < today;
    return true;
  });

  const totalSlots = filtered.reduce((s, e) => s + (e.max_sponsors || 0), 0);
  const totalSold = filtered.reduce((s, e) => s + e.sponsor_count, 0);
  const totalRevTarget = filtered.reduce((s, e) => s + (e.revenue_target || 0), 0);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(event: EventRow) {
    setEditingId(event.id);
    setForm({
      name: event.name || '',
      event_date: event.event_date || '',
      city: event.city || '',
      format: event.format || 'dinner',
      max_sponsors: event.max_sponsors || 2,
      price_per_slot: event.price_per_slot || 15000,
      sponsor_model: event.sponsor_model || 'co_sponsor',
      revenue_target: event.revenue_target || 30000,
      conference_association: event.conference_association || '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.event_date) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      event_date: form.event_date,
      city: form.city.trim(),
      format: form.format,
      max_sponsors: form.max_sponsors,
      price_per_slot: form.price_per_slot,
      sponsor_model: form.sponsor_model,
      revenue_target: form.revenue_target,
      conference_association: form.conference_association || null,
    };

    if (editingId) {
      await supabase.from('events').update(payload).eq('id', editingId);
      showToast('Event updated');
    } else {
      await supabase.from('events').insert(payload);
      showToast('Event created');
    }

    setSaving(false);
    setModalOpen(false);
    loadEvents();
  }

  async function handleDelete() {
    if (!editingId) return;
    if (!confirm('Delete this event? This cannot be undone.')) return;
    await supabase.from('events').delete().eq('id', editingId);
    showToast('Event deleted');
    setModalOpen(false);
    loadEvents();
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  function updateForm(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-title">Event Inventory</h1>
          <p className="page-subtitle">
            {filtered.length} events · {totalSold}/{totalSlots} slots sold · ${totalRevTarget.toLocaleString()} revenue target
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Event</button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
        {(['upcoming', 'past', 'all'] as const).map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-title">No events found</div>
              <div className="empty-state-text">
                {filter === 'upcoming' ? 'No upcoming events.' : 'No events match this filter.'}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={openCreate}>
                + Create First Event
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {filtered.map(event => {
            const max = event.max_sponsors || 1;
            const sold = event.sponsor_count;
            const available = Math.max(0, max - sold);
            const pct = Math.min(100, Math.round((sold / max) * 100));
            const isPast = event.event_date < today;
            const barColor = pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--blue)' : pct >= 30 ? 'var(--yellow)' : 'var(--red)';

            return (
              <div
                key={event.id}
                className="card"
                style={{ opacity: isPast ? 0.6 : 1, cursor: 'pointer' }}
                onClick={() => openEdit(event)}
              >
                <div className="card-body" style={{ display: 'grid', gap: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)', marginBottom: 4 }}>
                        {event.name}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        {event.event_date && (
                          <span>{new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        )}
                        {event.city && <span>· {event.city}</span>}
                        {event.format && <span>· {event.format}</span>}
                        {event.conference_association && <span>· {event.conference_association}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {event.price_per_slot > 0 && (
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                          ${event.price_per_slot.toLocaleString()}/slot
                        </div>
                      )}
                      {event.revenue_target > 0 && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                          Target: ${event.revenue_target.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {sold} sold · {available} available
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: barColor }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="inventory-bar">
                      <div className="inventory-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                  </div>

                  {event.sponsor_model && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      Model: {event.sponsor_model}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Event' : 'New Event'}</h2>
              <button className="btn-ghost" onClick={() => setModalOpen(false)} style={{ padding: 4, fontSize: 20 }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Event Name *</label>
                  <input className="input" placeholder="e.g. Dinner-Chicago-Oct_20_2026" value={form.name} onChange={e => updateForm('name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Date *</label>
                  <input className="input" type="date" value={form.event_date} onChange={e => updateForm('event_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">City</label>
                  <input className="input" placeholder="e.g. Chicago" value={form.city} onChange={e => updateForm('city', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Format</label>
                  <select className="select" value={form.format} onChange={e => updateForm('format', e.target.value)}>
                    <option value="dinner">Dinner</option>
                    <option value="breakfast">Breakfast</option>
                    <option value="shark_tank">Shark Tank</option>
                    <option value="briefing">Briefing</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Sponsor Model</label>
                  <select className="select" value={form.sponsor_model} onChange={e => updateForm('sponsor_model', e.target.value)}>
                    <option value="co_sponsor">Co-Sponsor</option>
                    <option value="exclusive_only">Exclusive Only</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Max Sponsors</label>
                  <input className="input" type="number" min="1" max="20" value={form.max_sponsors} onChange={e => updateForm('max_sponsors', parseInt(e.target.value) || 1)} />
                </div>
                <div className="form-group">
                  <label className="label">Price per Slot ($)</label>
                  <input className="input" type="number" min="0" step="1000" value={form.price_per_slot} onChange={e => updateForm('price_per_slot', parseInt(e.target.value) || 0)} />
                </div>
                <div className="form-group">
                  <label className="label">Revenue Target ($)</label>
                  <input className="input" type="number" min="0" step="1000" value={form.revenue_target} onChange={e => updateForm('revenue_target', parseInt(e.target.value) || 0)} />
                </div>
                <div className="form-group">
                  <label className="label">Conference (optional)</label>
                  <input className="input" placeholder="e.g. Re:Invent" value={form.conference_association} onChange={e => updateForm('conference_association', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div>
                {editingId && (
                  <button className="btn" style={{ color: 'var(--red)' }} onClick={handleDelete}>Delete Event</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim() || !form.event_date || saving}>
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Event'}
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

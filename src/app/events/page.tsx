// src/app/events/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

interface DealRow {
  id: string;
  event_id: string;
  amount: number | null;
  status: string;
  companies: { name: string } | null;
  contacts: { first_name: string | null; last_name: string | null; email: string | null } | null;
}

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

// Status buckets shown per event. Order = display order.
const BUCKETS: { key: string; label: string; badge: string }[] = [
  { key: 'prop_signed',  label: 'Sold',         badge: 'badge-green'  },
  { key: 'prop_sent',    label: 'Prop sent',    badge: 'badge-blue'   },
  { key: 'opportunity',  label: 'Opportunity',  badge: 'badge-yellow' },
  { key: 'closed_lost',  label: 'Closed lost',  badge: 'badge-red'    },
];
// Extra statuses only surfaced when present.
const EXTRA_BUCKETS: { key: string; label: string; badge: string }[] = [
  { key: 'no_inventory', label: 'No inventory', badge: 'badge-gray'   },
  { key: 'refunded',     label: 'Refunded',     badge: 'badge-purple' },
];
const ALL_BUCKETS = [...BUCKETS, ...EXTRA_BUCKETS];
const BADGE_FOR: Record<string, string> = Object.fromEntries(ALL_BUCKETS.map(b => [b.key, b.badge]));
const LABEL_FOR: Record<string, string> = Object.fromEntries(ALL_BUCKETS.map(b => [b.key, b.label]));

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
  const [dealsByEvent, setDealsByEvent] = useState<Record<string, DealRow[]>>({});
  const [expanded, setExpanded] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [fillFilter, setFillFilter] = useState<'all' | 'fully' | 'partial' | 'available'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const supabase = createClient();
  const router = useRouter();

  const loadEvents = useCallback(async () => {
    const [eventsRes, dealsRes] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: true }),
      supabase
        .from('deals')
        .select('id, event_id, amount, status, companies(name), contacts(first_name, last_name, email)')
        .not('event_id', 'is', null),
    ]);

    // Group all deals by event_id
    const byEvent: Record<string, DealRow[]> = {};
    (dealsRes.data as unknown as DealRow[] | null || []).forEach((d) => {
      if (!d.event_id) return;
      (byEvent[d.event_id] = byEvent[d.event_id] || []).push(d);
    });

    // Sold slots = signed deals attributable to the event
    const enriched = (eventsRes.data || []).map((e: Record<string, unknown>) => {
      const id = e.id as string;
      const deals = byEvent[id] || [];
      const sold = deals.filter(d => d.status === 'prop_signed').length;
      return { ...e, sponsor_count: sold } as unknown as EventRow;
    });

    setDealsByEvent(byEvent);
    setEvents(enriched);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const today = new Date().toISOString().slice(0, 10);

  // Sponsorship fill state of an event
  function fillState(e: EventRow): 'fully' | 'partial' | 'available' {
    const max = e.max_sponsors || 1;
    const sold = e.sponsor_count;
    if (sold <= 0) return 'available';
    if (sold >= max) return 'fully';
    return 'partial';
  }

  const timeFiltered = events.filter(e => {
    if (filter === 'upcoming') return e.event_date >= today;
    if (filter === 'past') return e.event_date < today;
    return true;
  });

  // Counts per fill state within the current time scope (for the toggle badges)
  const fillCounts = { fully: 0, partial: 0, available: 0 };
  timeFiltered.forEach(e => { fillCounts[fillState(e)] += 1; });

  const filtered = fillFilter === 'all'
    ? timeFiltered
    : timeFiltered.filter(e => fillState(e) === fillFilter);

  const totalSlots = filtered.reduce((s, e) => s + (e.max_sponsors || 0), 0);
  const totalSold = filtered.reduce((s, e) => s + e.sponsor_count, 0);
  const totalRevTarget = filtered.reduce((s, e) => s + (e.revenue_target || 0), 0);

  // Aggregate pipeline counts across the filtered events
  const agg = filtered.reduce(
    (acc, e) => {
      (dealsByEvent[e.id] || []).forEach(d => {
        acc[d.status] = (acc[d.status] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>
  );

  function bucketsForEvent(eventId: string) {
    const deals = dealsByEvent[eventId] || [];
    const counts: Record<string, { count: number; amount: number }> = {};
    deals.forEach(d => {
      const b = (counts[d.status] = counts[d.status] || { count: 0, amount: 0 });
      b.count += 1;
      b.amount += d.amount || 0;
    });
    // Always show the 4 core buckets; add extras only if they have deals.
    const visible = [...BUCKETS];
    EXTRA_BUCKETS.forEach(b => { if (counts[b.key]?.count) visible.push(b); });
    return { visible, counts };
  }

  function toggleBucket(eventId: string, key: string) {
    setExpanded(prev => ({ ...prev, [eventId]: prev[eventId] === key ? null : key }));
  }

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

  function contactName(c: DealRow['contacts']) {
    if (!c) return null;
    const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
    return n || null;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-title">Event Inventory</h1>
          <p className="page-subtitle">
            {filtered.length} events · {totalSold}/{totalSlots} slots sold · ${totalRevTarget.toLocaleString()} revenue target
            {(agg.prop_sent || agg.opportunity) ? (
              <> · {agg.prop_sent || 0} props out · {agg.opportunity || 0} open opps</>
            ) : null}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Event</button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
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

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {([
            { key: 'all',       label: 'All',                  dot: null            },
            { key: 'fully',     label: 'Fully sponsored',      dot: 'var(--green)'  },
            { key: 'partial',   label: 'Partially sponsored',  dot: 'var(--yellow)' },
            { key: 'available', label: 'Fully available',      dot: 'var(--red)'    },
          ] as const).map(o => (
            <button
              key={o.key}
              className={`btn btn-sm ${fillFilter === o.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFillFilter(o.key)}
            >
              {o.dot && (
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: o.dot, marginRight: 6, verticalAlign: 'middle' }} />
              )}
              {o.label}
              {o.key !== 'all' && (
                <span style={{ marginLeft: 6, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
                  {fillCounts[o.key as 'fully' | 'partial' | 'available']}
                </span>
              )}
            </button>
          ))}
        </div>
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

            const { visible, counts } = bucketsForEvent(event.id);
            const activeBucket = expanded[event.id] || null;
            const activeDeals = activeBucket
              ? (dealsByEvent[event.id] || []).filter(d => d.status === activeBucket)
              : [];

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
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); router.push(`/events/${event.id}`); }}
                        style={{ marginBottom: 6 }}
                      >
                        Open &rarr;
                      </button>
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

                  {/* ═══ DEAL DRILL-DOWN (does not trigger the edit modal) ═══ */}
                  <div onClick={e => e.stopPropagation()} style={{ cursor: 'default', borderTop: '1px solid var(--border-default)', paddingTop: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {visible.map(b => {
                        const count = counts[b.key]?.count || 0;
                        const amount = counts[b.key]?.amount || 0;
                        const isActive = activeBucket === b.key;
                        return (
                          <button
                            key={b.key}
                            onClick={() => count > 0 && toggleBucket(event.id, b.key)}
                            disabled={count === 0}
                            title={amount > 0 ? `$${amount.toLocaleString()}` : undefined}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '4px 10px', borderRadius: 'var(--radius-md)',
                              fontSize: 'var(--text-xs)', fontWeight: 600,
                              border: '1px solid var(--border-default)',
                              background: isActive ? 'var(--bg-card)' : 'transparent',
                              outline: isActive ? '2px solid var(--accent)' : 'none',
                              color: count === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                              cursor: count === 0 ? 'default' : 'pointer',
                              opacity: count === 0 ? 0.5 : 1,
                            }}
                          >
                            <span className={`badge ${b.badge}`} style={{ fontSize: 'var(--text-xs)' }}>{count}</span>
                            {b.label}
                          </button>
                        );
                      })}
                    </div>

                    {activeBucket && (
                      <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-1)' }}>
                        {activeDeals.length === 0 ? (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>No {LABEL_FOR[activeBucket]?.toLowerCase()} deals.</div>
                        ) : (
                          activeDeals.map(d => (
                            <div
                              key={d.id}
                              style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)',
                                padding: '6px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {d.companies?.name || '—'}
                                </span>
                                {contactName(d.contacts) && (
                                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 'var(--space-2)' }}>
                                    {contactName(d.contacts)}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
                                <span className={`badge ${BADGE_FOR[d.status] || 'badge-gray'}`} style={{ fontSize: 'var(--text-xs)' }}>
                                  {LABEL_FOR[d.status] || d.status}
                                </span>
                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right' }}>
                                  ${(d.amount || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
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

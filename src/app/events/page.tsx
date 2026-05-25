// app/events/page.tsx
// Screen 4: Event Inventory Dashboard — slot tracking, revenue bars, color-coded status

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import { FORMAT_LABELS } from '@/lib/supabase-types';
import type { EventFormat } from '@/lib/supabase-types';

const supabase = createClient();

function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return '$0';
  return `$${amount.toLocaleString()}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'TBD';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type EventStatus = 'sold_out' | 'partial' | 'unsold' | 'past';

function getEventStatus(event: any): EventStatus {
  if (event.event_date && new Date(event.event_date) < new Date()) return 'past';
  const filled = event.sponsors_confirmed || 0;
  if (filled >= event.max_sponsors) return 'sold_out';
  if (filled > 0) return 'partial';
  return 'unsold';
}

const STATUS_CONFIG: Record<EventStatus, { label: string; color: string; bg: string }> = {
  sold_out: { label: 'Sold Out', color: 'var(--green)', bg: 'var(--green-soft)' },
  partial:  { label: 'Partially Sold', color: 'var(--yellow)', bg: 'var(--yellow-soft)' },
  unsold:   { label: 'Unsold', color: 'var(--red)', bg: 'var(--red-soft)' },
  past:     { label: 'Past', color: 'var(--gray)', bg: 'var(--gray-soft)' },
};

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formatFilter, setFormatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sponsors, setSponsors] = useState<any[]>([]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    // Use the event_inventory view if available, otherwise compute
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_sponsors(id, company:companies(id, name), amount_paid, sponsor_type, deal:deals(id, status, amount))
      `)
      .order('event_date', { ascending: true, nullsFirst: false });

    if (!error && data) {
      const enriched = data.map(e => ({
        ...e,
        sponsors_confirmed: e.event_sponsors?.length || 0,
        slots_available: e.max_sponsors - (e.event_sponsors?.length || 0),
        revenue_collected: e.event_sponsors?.reduce((s: number, sp: any) => s + (sp.amount_paid || 0), 0) || 0,
      }));
      setEvents(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Filters
  const filtered = events.filter(e => {
    if (formatFilter && e.format !== formatFilter) return false;
    if (statusFilter && getEventStatus(e) !== statusFilter) return false;
    return true;
  });

  // Summary stats
  const totalSlots = filtered.reduce((s, e) => s + e.max_sponsors, 0);
  const filledSlots = filtered.reduce((s, e) => s + (e.sponsors_confirmed || 0), 0);
  const totalRevTarget = filtered.reduce((s, e) => s + (e.revenue_target || 0), 0);
  const totalRevCollected = filtered.reduce((s, e) => s + (e.revenue_collected || 0), 0);

  // Expand event
  const handleExpandEvent = async (eventId: string) => {
    if (expandedId === eventId) { setExpandedId(null); return; }
    setExpandedId(eventId);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title">Event Inventory</h1>
          <p className="page-subtitle">{filtered.length} events</p>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card stat-card">
          <span className="stat-value">{totalSlots}</span>
          <span className="stat-label">Total Slots</span>
        </div>
        <div className="card stat-card">
          <span className="stat-value" style={{ color: 'var(--green)' }}>{filledSlots}</span>
          <span className="stat-label">Filled</span>
        </div>
        <div className="card stat-card">
          <span className="stat-value" style={{ color: 'var(--red)' }}>{totalSlots - filledSlots}</span>
          <span className="stat-label">Available</span>
        </div>
        <div className="card stat-card">
          <span className="stat-value" style={{ color: 'var(--accent)' }}>{formatCurrency(totalRevCollected)}</span>
          <span className="stat-label">Revenue Collected</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-row" style={{ marginBottom: 'var(--space-5)' }}>
        <select
          className="input select"
          style={{ width: 180 }}
          value={formatFilter}
          onChange={e => setFormatFilter(e.target.value)}
        >
          <option value="">All Formats</option>
          {(['dinner', 'breakfast', 'shark_tank', 'briefing', 'other'] as EventFormat[]).map(f => (
            <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
          ))}
        </select>

        <select
          className="input select"
          style={{ width: 180 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="sold_out">Sold Out</option>
          <option value="partial">Partially Sold</option>
          <option value="unsold">Unsold</option>
          <option value="past">Past</option>
        </select>
      </div>

      {/* Event cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {filtered.map(event => {
          const status = getEventStatus(event);
          const config = STATUS_CONFIG[status];
          const fillPct = event.max_sponsors > 0 ? (event.sponsors_confirmed / event.max_sponsors) * 100 : 0;
          const revPct = event.revenue_target ? (event.revenue_collected / event.revenue_target) * 100 : 0;
          const isExpanded = expandedId === event.id;

          return (
            <div key={event.id} className="card" style={{ padding: 0, cursor: 'pointer' }} onClick={() => handleExpandEvent(event.id)}>
              {/* Main row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1.5fr 120px',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-5) var(--space-6)',
              }}>
                {/* Name + date */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{event.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <span>{formatDate(event.event_date)}</span>
                    {event.city && <span>· {event.city}</span>}
                    {event.conference_association && (
                      <span className="badge badge-blue" style={{ fontSize: 11 }}>
                        {event.conference_association}
                      </span>
                    )}
                  </div>
                </div>

                {/* Format */}
                <div>
                  <span className="badge badge-gray" style={{ fontSize: 'var(--text-xs)' }}>
                    {FORMAT_LABELS[event.format as EventFormat] || event.format}
                  </span>
                </div>

                {/* Status */}
                <div>
                  <span className="badge" style={{ background: config.bg, color: config.color }}>
                    {config.label}
                  </span>
                </div>

                {/* Slot inventory bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                      {event.sponsors_confirmed}/{event.max_sponsors} slots
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: config.color, fontWeight: 600 }}>
                      {event.slots_available} avail
                    </span>
                  </div>
                  <div className="inventory-bar">
                    <div className="inventory-bar-fill" style={{ width: `${fillPct}%`, background: config.color }} />
                  </div>
                </div>

                {/* Revenue */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                      {formatCurrency(event.revenue_collected)}
                    </span>
                    {event.revenue_target && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        / {formatCurrency(event.revenue_target)}
                      </span>
                    )}
                  </div>
                  {event.revenue_target ? (
                    <div className="inventory-bar">
                      <div className="inventory-bar-fill" style={{
                        width: `${Math.min(100, revPct)}%`,
                        background: revPct >= 100 ? 'var(--green)' : 'var(--accent)',
                      }} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>No target set</div>
                  )}
                </div>

                {/* Expand arrow */}
                <div style={{ textAlign: 'right', fontSize: 'var(--text-lg)', color: 'var(--text-tertiary)' }}>
                  {isExpanded ? '▾' : '▸'}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{
                  borderTop: '1px solid var(--border-default)',
                  padding: 'var(--space-5) var(--space-6)',
                  background: 'var(--bg-sidebar)',
                }}>
                  {/* Sponsors list */}
                  {event.event_sponsors?.length > 0 ? (
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                        Confirmed Sponsors
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {event.event_sponsors.map((sp: any) => (
                          <div key={sp.id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-default)',
                          }}>
                            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                              {sp.company?.name || 'Unknown'}
                            </span>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                              <span className="badge badge-blue" style={{ fontSize: 11 }}>
                                {sp.sponsor_type === 'exclusive' ? 'Exclusive' : sp.sponsor_type === 'co_sponsor' ? 'Co-Sponsor' : 'Vendor Slot'}
                              </span>
                              {sp.deal?.status && (
                                <span className="badge badge-gray" style={{ fontSize: 11 }}>
                                  {sp.deal.status === 'invoice_paid' ? '✓ Paid' : sp.deal.status === 'prop_signed' ? 'Signed' : sp.deal.status}
                                </span>
                              )}
                              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(sp.amount_paid || sp.deal?.amount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                      No sponsors confirmed yet.
                    </div>
                  )}

                  {/* Notes */}
                  {event.notes && (
                    <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                      <strong>Notes:</strong> {event.notes}
                    </div>
                  )}

                  {/* Quick actions */}
                  <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
                    <a href={`/pitch?event=${event.id}`} className="btn btn-primary btn-sm">
                      🎯 Find Pitch Candidates
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-tertiary)' }}>
            No events match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

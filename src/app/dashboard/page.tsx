// src/app/dashboard/page.tsx
// Dashboard: Unsold inventory, pipeline summary, clients due for cross-sell

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { DEAL_STAGE_LABELS } from '@/lib/supabase-types';

const supabase = createClient();

interface EventInventory {
  id: string;
  name: string;
  event_date: string | null;
  city: string | null;
  max_sponsors: number;
  price_per_slot: number | null;
  revenue_target: number | null;
  sponsors_confirmed: number;
  revenue_booked: number;
}

interface PipelineDeal {
  id: string;
  company_id: string;
  amount: number | null;
  status: string;
  sent_date: string | null;
  follow_up_date: string | null;
  follow_up: string | null;
  companies: { name: string } | null;
  contacts: { first_name: string; last_name: string } | null;
  events: { name: string } | null;
}

interface ClientGap {
  id: string;
  name: string;
  status: string;
  deal_count: number;
}

const STAGE_BADGE: Record<string, string> = {
  draft: 'badge-yellow', prop_sent: 'badge-blue', prop_signed: 'badge-green',
  invoice_sent: 'badge-purple', invoice_paid: 'badge-green', closed_lost: 'badge-red',
};

export default function DashboardPage() {
  const [events, setEvents] = useState<EventInventory[]>([]);
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [clientGaps, setClientGaps] = useState<ClientGap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadEvents(), loadPipeline(), loadClientGaps()]);
    setLoading(false);
  }

  async function loadEvents() {
    // Get events with sponsor counts
    const { data: eventData } = await supabase
      .from('events')
      .select('id, name, event_date, city, max_sponsors, price_per_slot, revenue_target')
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .order('event_date', { ascending: true });

    if (!eventData) { setEvents([]); return; }

    // Get sponsor counts per event
    const { data: sponsors } = await supabase
      .from('event_sponsors')
      .select('event_id, id');

    // Get booked revenue per event from deals
    const { data: dealData } = await supabase
      .from('deals')
      .select('event_id, amount, status')
      .in('status', ['prop_signed', 'invoice_sent', 'invoice_paid']);

    const sponsorCounts: Record<string, number> = {};
    const revBooked: Record<string, number> = {};
    sponsors?.forEach((s: any) => { sponsorCounts[s.event_id] = (sponsorCounts[s.event_id] || 0) + 1; });
    dealData?.forEach((d: any) => { if (d.event_id) revBooked[d.event_id] = (revBooked[d.event_id] || 0) + (d.amount || 0); });

    setEvents(eventData.map(e => ({
      ...e,
      sponsors_confirmed: sponsorCounts[e.id] || 0,
      revenue_booked: revBooked[e.id] || 0,
    })));
  }

  async function loadPipeline() {
    const { data } = await supabase
      .from('deals')
      .select('id, company_id, amount, status, sent_date, follow_up_date, follow_up, companies(name), contacts(first_name, last_name), events(name)')
      .in('status', ['draft', 'prop_sent', 'prop_signed'])
      .order('sent_date', { ascending: true });
    setDeals((data as unknown as PipelineDeal[]) || []);
  }

  async function loadClientGaps() {
    // Get all client companies
    const { data: clients } = await supabase
      .from('companies')
      .select('id, name, status')
      .eq('status', 'client');

    if (!clients) { setClientGaps([]); return; }

    // Get active deals (draft, prop_sent, prop_signed) per company
    const { data: activeDeals } = await supabase
      .from('deals')
      .select('company_id, id')
      .in('status', ['draft', 'prop_sent', 'prop_signed']);

    const activeDealCounts: Record<string, number> = {};
    activeDeals?.forEach((d: any) => { activeDealCounts[d.company_id] = (activeDealCounts[d.company_id] || 0) + 1; });

    setClientGaps(
      clients
        .filter(c => !activeDealCounts[c.id])
        .map(c => ({ ...c, deal_count: 0 }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  function daysSince(dateStr: string | null) {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000);
  }

  // Summary stats
  const totalPipelineValue = deals.reduce((s, d) => s + (d.amount || 0), 0);
  const propsSent = deals.filter(d => d.status === 'prop_sent');
  const propsSentValue = propsSent.reduce((s, d) => s + (d.amount || 0), 0);
  const overdueFollowups = deals.filter(d => d.follow_up_date && d.follow_up_date < today);
  const unsoldSlots = events.reduce((s, e) => s + Math.max(0, e.max_sponsors - e.sponsors_confirmed), 0);
  const unsoldRevenue = events.reduce((s, e) => {
    const slotsOpen = Math.max(0, e.max_sponsors - e.sponsors_confirmed);
    return s + slotsOpen * (e.price_per_slot || 0);
  }, 0);

  if (loading) return <div style={{ padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>Loading dashboard…</div>;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Pipeline health at a glance</p>
      </div>

      {/* ═══ STAT CARDS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div className="card">
          <div className="stat-card">
            <span className="stat-value" style={{ color: 'var(--accent)' }}>${totalPipelineValue.toLocaleString()}</span>
            <span className="stat-label">Open pipeline</span>
          </div>
        </div>
        <div className="card">
          <div className="stat-card">
            <span className="stat-value" style={{ color: 'var(--purple)' }}>{propsSent.length}</span>
            <span className="stat-label">Proposals out (${propsSentValue.toLocaleString()})</span>
          </div>
        </div>
        <div className="card">
          <div className="stat-card">
            <span className="stat-value" style={{ color: 'var(--orange)' }}>{unsoldSlots}</span>
            <span className="stat-label">Unsold slots (${unsoldRevenue.toLocaleString()})</span>
          </div>
        </div>
        <div className="card">
          <div className="stat-card">
            <span className="stat-value" style={{ color: overdueFollowups.length > 0 ? 'var(--red)' : 'var(--green)' }}>{overdueFollowups.length}</span>
            <span className="stat-label">Overdue follow-ups</span>
          </div>
        </div>
      </div>

      {/* ═══ UNSOLD INVENTORY ═══ */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Unsold Inventory</h2>
        {events.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)' }}>No upcoming events.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>City</th>
                  <th>Slots</th>
                  <th>Fill rate</th>
                  <th style={{ textAlign: 'right' }}>Revenue gap</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => {
                  const slotsOpen = Math.max(0, e.max_sponsors - e.sponsors_confirmed);
                  const fillPct = e.max_sponsors > 0 ? Math.round((e.sponsors_confirmed / e.max_sponsors) * 100) : 0;
                  const gap = (e.revenue_target || 0) - e.revenue_booked;
                  return (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600 }}>{e.name}</td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>
                        {e.event_date ? new Date(e.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{e.city || '—'}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{e.sponsors_confirmed}</span>
                        <span style={{ color: 'var(--text-tertiary)' }}> / {e.max_sponsors}</span>
                        {slotsOpen > 0 && <span className="badge badge-orange" style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>{slotsOpen} open</span>}
                      </td>
                      <td>
                        <div className="inventory-bar" style={{ width: 100 }}>
                          <div className="inventory-bar-fill" style={{
                            width: `${fillPct}%`,
                            background: fillPct === 100 ? 'var(--green)' : fillPct >= 50 ? 'var(--yellow)' : 'var(--red)',
                          }} />
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: gap > 0 ? 'var(--red)' : 'var(--green)' }}>
                        {gap > 0 ? `-$${gap.toLocaleString()}` : '✓'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ PIPELINE — PROPOSALS SENT ═══ */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Active Pipeline</h2>
        {deals.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)' }}>No active deals.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Event</th>
                  <th>Stage</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Age</th>
                  <th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {deals.map(d => {
                  const age = daysSince(d.sent_date);
                  const isOverdue = d.follow_up_date && d.follow_up_date < today;
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>
                        <Link href={`/companies/${d.company_id}`} style={{ textDecoration: 'none' }}>{d.companies?.name || '—'}</Link>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{d.events?.name || '—'}</td>
                      <td><span className={`badge ${STAGE_BADGE[d.status] || 'badge-gray'}`}>{DEAL_STAGE_LABELS[d.status] || d.status}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${(d.amount || 0).toLocaleString()}</td>
                      <td>
                        {age != null && age > 0 ? (
                          <span className={`badge ${age > 14 ? 'badge-red' : age > 7 ? 'badge-yellow' : 'badge-gray'}`}>{age}d</span>
                        ) : '—'}
                      </td>
                      <td>
                        <div style={{ fontSize: 'var(--text-sm)', color: isOverdue ? 'var(--red)' : 'var(--text-secondary)', fontWeight: isOverdue ? 600 : 400 }}>
                          {isOverdue && '⚠️ '}
                          {d.follow_up || ''}
                          {d.follow_up_date && (
                            <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                              {new Date(d.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ CLIENTS DUE FOR CROSS-SELL ═══ */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
          Clients with no active deals
          {clientGaps.length > 0 && <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 'var(--space-2)' }}>({clientGaps.length} due for cross-sell)</span>}
        </h2>
        {clientGaps.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)' }}>All clients have active deals. Nice.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            {clientGaps.map(c => (
              <Link key={c.id} href={`/companies/${c.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: 'var(--space-4)', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>{c.name}</div>
                  <span className="badge badge-green" style={{ fontSize: 'var(--text-xs)' }}>Client</span>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>No active proposals</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

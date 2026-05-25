// src/app/page.tsx
// Dashboard — The Morning Briefing (Step 2)
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

/* ── Types ── */
interface EventWithSlots {
  id: string;
  name: string;
  date: string;
  city: string;
  format: string;
  max_sponsors: number;
  price_per_slot: number;
  revenue_target: number;
  conference_id: string;
  conferences: { name: string } | null;
  sold: number;
  available: number;
  daysUntil: number;
  heatScore: number;
}

interface CompanyCandidate {
  id: string;
  name: string;
  domain: string;
  status: string;
  bestWarmth: string;
  bestContactName: string;
  lastInteractionDate: string | null;
  lastInteractionSnippet: string | null;
  score: number;
  reason: string;
}

interface Deal {
  id: string;
  company_id: string;
  contact_id: string;
  event_id: string;
  amount: number;
  stage: string;
  follow_up_date: string | null;
  created_at: string;
  companies: { name: string } | null;
  contacts: { name: string } | null;
  events: { name: string } | null;
}

interface Interaction {
  id: string;
  company_id: string;
  source: string;
  notes: string;
  follow_up: string | null;
  follow_up_date: string | null;
  created_at: string;
  companies: { name: string } | null;
}

interface Stats {
  companies: number;
  contacts: number;
  events: number;
  deals: number;
  pipelineTotal: number;
  upcomingEvents: number;
}

/* ── Constants ── */
const WARMTH_ORDER: Record<string, number> = { hot: 4, warm: 3, cool: 2, cold: 1 };
const WARMTH_BADGE: Record<string, string> = {
  hot: 'badge-red', warm: 'badge-orange', cool: 'badge-blue', cold: 'badge-neutral',
};
const STATUS_BADGE: Record<string, string> = {
  client: 'badge-green', prospect: 'badge-blue', lead: 'badge-yellow',
  churned: 'badge-red', dni: 'badge-red',
};
const STAGE_LABELS: Record<string, string> = {
  draft: 'Draft', prop_sent: 'Proposal Sent', prop_signed: 'Signed',
};
const STAGE_COLOR: Record<string, string> = {
  draft: 'var(--yellow)', prop_sent: 'var(--blue)', prop_signed: 'var(--green)',
};

/* ── Helper: days between ── */
function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T12:00:00');
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

/* ── Helper: heat score ── */
// Higher = more urgent to sell. Combines time pressure + vacancy.
function computeHeatScore(daysLeft: number, available: number, max: number): number {
  if (daysLeft <= 0 || available <= 0) return 0;
  const vacancy = available / Math.max(max, 1); // 0–1, higher = more empty
  const urgency = Math.max(0, 1 - daysLeft / 120); // 0–1, higher = sooner
  return Math.round((urgency * 0.6 + vacancy * 0.4) * 100);
}

/* ── Helper: truncate ── */
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<Stats>({
    companies: 0, contacts: 0, events: 0, deals: 0, pipelineTotal: 0, upcomingEvents: 0,
  });
  const [inventoryEvents, setInventoryEvents] = useState<EventWithSlots[]>([]);
  const [candidatesByEvent, setCandidatesByEvent] = useState<Record<string, CompanyCandidate[]>>({});
  const [deals, setDeals] = useState<Deal[]>([]);
  const [recentNotes, setRecentNotes] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboard() {
    const today = new Date().toISOString().slice(0, 10);

    // ── Parallel fetches ──
    const [
      companiesCount,
      contactsCount,
      eventsCount,
      dealsRes,
      eventsRes,
      sponsorsRes,
      interactionsRes,
    ] = await Promise.all([
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('contacts').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('deals').select('*, companies(name), contacts(name), events(name)').order('created_at', { ascending: false }),
      supabase.from('events').select('*, conferences(name)').gte('date', today).order('date', { ascending: true }),
      supabase.from('event_sponsors').select('event_id, company_id'),
      supabase.from('interactions').select('*, companies(name)').order('created_at', { ascending: false }).limit(20),
    ]);

    const allDeals = (dealsRes.data || []) as unknown as Deal[];
    const allEvents = (eventsRes.data || []) as unknown as Array<Record<string, unknown>>;
    const allSponsors = (sponsorsRes.data || []) as Array<{ event_id: string; company_id: string }>;
    const allInteractions = (interactionsRes.data || []) as unknown as Interaction[];

    // ── Stats ──
    const pipelineTotal = allDeals
      .filter(d => d.stage !== 'prop_signed')
      .reduce((sum, d) => sum + (d.amount || 0), 0);

    setStats({
      companies: companiesCount.count || 0,
      contacts: contactsCount.count || 0,
      events: eventsCount.count || 0,
      deals: allDeals.length,
      pipelineTotal,
      upcomingEvents: allEvents.length,
    });

    // ── Sponsor counts per event ──
    const sponsorCountMap: Record<string, number> = {};
    const sponsorCompanyMap: Record<string, Set<string>> = {};
    allSponsors.forEach(s => {
      sponsorCountMap[s.event_id] = (sponsorCountMap[s.event_id] || 0) + 1;
      if (!sponsorCompanyMap[s.event_id]) sponsorCompanyMap[s.event_id] = new Set();
      sponsorCompanyMap[s.event_id].add(s.company_id);
    });

    // ── Build inventory events with heat score ──
    const enrichedEvents: EventWithSlots[] = allEvents.map(e => {
      const max = (e.max_sponsors as number) || 0;
      const sold = sponsorCountMap[e.id as string] || 0;
      const available = Math.max(0, max - sold);
      const days = daysUntil(e.date as string);
      return {
        id: e.id as string,
        name: e.name as string,
        date: e.date as string,
        city: e.city as string,
        format: e.format as string,
        max_sponsors: max,
        price_per_slot: (e.price_per_slot as number) || 0,
        revenue_target: (e.revenue_target as number) || 0,
        conference_id: e.conference_id as string,
        conferences: e.conferences as { name: string } | null,
        sold,
        available,
        daysUntil: days,
        heatScore: computeHeatScore(days, available, max),
      };
    }).filter(e => e.available > 0 && e.daysUntil > 0)
      .sort((a, b) => b.heatScore - a.heatScore);

    setInventoryEvents(enrichedEvents);
    setDeals(allDeals);
    setRecentNotes(allInteractions);

    // ── Auto-expand first event ──
    if (enrichedEvents.length > 0) {
      setExpandedEvent(enrichedEvents[0].id);
      await loadCandidatesForEvent(enrichedEvents[0].id, sponsorCompanyMap, allInteractions);
    }

    setLoading(false);
  }

  async function loadCandidatesForEvent(
    eventId: string,
    sponsorCompanyMap?: Record<string, Set<string>>,
    interactionsData?: Interaction[],
  ) {
    // Get all companies with status != dni
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, domain, status')
      .neq('status', 'dni')
      .limit(500);

    if (!companies) return;

    // Get contacts grouped by company (best warmth)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, company_id, warmth')
      .in('company_id', companies.map(c => c.id))
      .limit(2000);

    // Get recent interactions per company
    const { data: interactions } = interactionsData
      ? { data: null } // use passed data
      : await supabase
        .from('interactions')
        .select('company_id, notes, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

    const interactionList = interactions || interactionsData || [];

    // Get already-sponsored companies for this event
    let alreadySponsored: Set<string>;
    if (sponsorCompanyMap && sponsorCompanyMap[eventId]) {
      alreadySponsored = sponsorCompanyMap[eventId];
    } else {
      const { data: sponsors } = await supabase
        .from('event_sponsors')
        .select('company_id')
        .eq('event_id', eventId);
      alreadySponsored = new Set((sponsors || []).map(s => s.company_id));
    }

    // Build contact map: company_id → best contact
    const contactMap: Record<string, { name: string; warmth: string }> = {};
    (contacts || []).forEach((ct: Record<string, string>) => {
      const existing = contactMap[ct.company_id];
      const ctWarmth = WARMTH_ORDER[ct.warmth] || 0;
      if (!existing || ctWarmth > (WARMTH_ORDER[existing.warmth] || 0)) {
        contactMap[ct.company_id] = { name: ct.name, warmth: ct.warmth };
      }
    });

    // Build interaction map: company_id → latest
    const interactionMap: Record<string, { date: string; snippet: string }> = {};
    (interactionList as Array<Record<string, unknown>>).forEach((i) => {
      const cid = i.company_id as string;
      if (!interactionMap[cid]) {
        interactionMap[cid] = {
          date: i.created_at as string,
          snippet: truncate((i.notes as string) || '', 80),
        };
      }
    });

    // Score companies
    const candidates: CompanyCandidate[] = companies
      .filter(c => !alreadySponsored.has(c.id))
      .map(c => {
        let score = 0;
        let reason = '';
        const contact = contactMap[c.id];
        const interaction = interactionMap[c.id];
        const warmthScore = contact ? (WARMTH_ORDER[contact.warmth] || 0) : 0;

        // Clients who bought before: +40
        if (c.status === 'client') { score += 40; reason = 'Past client'; }
        // Prospects in active conversation: +30
        else if (c.status === 'prospect' && interaction) { score += 30; reason = 'Active prospect'; }
        // Any prospect: +15
        else if (c.status === 'prospect') { score += 15; reason = 'Prospect'; }
        // Lead: +5
        else if (c.status === 'lead') { score += 5; reason = 'Lead'; }

        // Warm contacts: +10 per warmth level
        score += warmthScore * 10;

        // Recent interaction: +15 if within 30 days, +8 if within 90
        if (interaction) {
          const daysSince = daysUntil(interaction.date.slice(0, 10)) * -1;
          if (daysSince <= 30) score += 15;
          else if (daysSince <= 90) score += 8;
        }

        return {
          id: c.id,
          name: c.name,
          domain: c.domain,
          status: c.status,
          bestWarmth: contact?.warmth || 'unknown',
          bestContactName: contact?.name || '—',
          lastInteractionDate: interaction?.date?.slice(0, 10) || null,
          lastInteractionSnippet: interaction?.snippet || null,
          score,
          reason,
        };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    setCandidatesByEvent(prev => ({ ...prev, [eventId]: candidates }));
  }

  /* ── Derived data ── */
  const dealsByStage = useMemo(() => {
    const stages = ['draft', 'prop_sent', 'prop_signed'];
    return stages.reduce((acc, stage) => {
      acc[stage] = deals.filter(d => d.stage === stage);
      return acc;
    }, {} as Record<string, Deal[]>);
  }, [deals]);

  const overdueDeals = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return deals.filter(d =>
      d.follow_up_date && d.follow_up_date < today && d.stage !== 'prop_signed'
    );
  }, [deals]);

  const stuckDeals = useMemo(() => {
    // Deals in draft or prop_sent for more than 14 days with no recent interaction
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    return deals.filter(d =>
      (d.stage === 'draft' || d.stage === 'prop_sent') &&
      new Date(d.created_at) < cutoff
    );
  }, [deals]);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Loading your morning briefing…</p>
        </div>
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-lg)' }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Your morning briefing — inventory priorities and pipeline health</p>
      </div>

      {/* ── Quick Stats ── */}
      <div className="stats-row" style={{ marginBottom: 'var(--space-8)' }}>
        {[
          { label: 'Companies', value: stats.companies.toLocaleString(), color: 'var(--accent)' },
          { label: 'Contacts', value: stats.contacts.toLocaleString(), color: 'var(--blue)' },
          { label: 'Upcoming Events', value: stats.upcomingEvents.toLocaleString(), color: 'var(--green)' },
          { label: 'Open Pipeline', value: `$${stats.pipelineTotal.toLocaleString()}`, color: 'var(--orange)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 'var(--space-5) var(--space-6)' }}>
            <div className="stat-card">
              <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Alerts (overdue follow-ups) ── */}
      {overdueDeals.length > 0 && (
        <div className="alert-bar alert-bar-error" style={{ marginBottom: 'var(--space-6)' }}>
          ⚠️ {overdueDeals.length} deal{overdueDeals.length > 1 ? 's' : ''} with overdue follow-ups:
          {overdueDeals.slice(0, 3).map(d => (
            <span key={d.id} style={{ marginLeft: 12, fontWeight: 600 }}>
              {d.companies?.name} ({new Date(d.follow_up_date! + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
            </span>
          ))}
          {overdueDeals.length > 3 && <span style={{ marginLeft: 8 }}>+{overdueDeals.length - 3} more</span>}
        </div>
      )}

      {/* ── INVENTORY PRIORITIZATION ENGINE ── */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <h2 className="card-title">🎯 Inventory Prioritization Engine</h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {inventoryEvents.length} events with open slots
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {inventoryEvents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">All events fully booked or past</div>
              <div className="empty-state-text">Nice work. Time to create new events.</div>
            </div>
          ) : (
            <div>
              {inventoryEvents.map((event, idx) => {
                const isExpanded = expandedEvent === event.id;
                const candidates = candidatesByEvent[event.id] || [];
                const pctSold = Math.round((event.sold / Math.max(event.max_sponsors, 1)) * 100);
                const barColor = event.heatScore >= 70 ? 'var(--red)' : event.heatScore >= 40 ? 'var(--yellow)' : 'var(--blue)';

                return (
                  <div key={event.id} style={{
                    borderBottom: idx < inventoryEvents.length - 1 ? '1px solid var(--border-default)' : 'none',
                  }}>
                    {/* Event row */}
                    <div
                      onClick={() => {
                        const newId = isExpanded ? null : event.id;
                        setExpandedEvent(newId);
                        if (newId && !candidatesByEvent[newId]) {
                          loadCandidatesForEvent(newId);
                        }
                      }}
                      style={{
                        padding: 'var(--space-4) var(--space-6)',
                        cursor: 'pointer',
                        display: 'grid',
                        gridTemplateColumns: '1fr 160px 140px 80px',
                        gap: 'var(--space-4)',
                        alignItems: 'center',
                        background: isExpanded ? 'var(--accent-soft)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)', marginBottom: 2 }}>
                          {isExpanded ? '▼' : '▶'} {event.name}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                          {new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {event.city && ` · ${event.city}`}
                          {event.format && ` · ${event.format}`}
                          {event.conferences?.name && ` · ${event.conferences.name}`}
                        </div>
                      </div>

                      {/* Inventory bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            {event.sold}/{event.max_sponsors} sold
                          </span>
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: barColor }}>
                            {pctSold}%
                          </span>
                        </div>
                        <div className="inventory-bar">
                          <div className="inventory-bar-fill" style={{ width: `${pctSold}%`, background: barColor }} />
                        </div>
                      </div>

                      {/* Days until + price */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: event.daysUntil <= 21 ? 'var(--red)' : 'var(--text-primary)' }}>
                          {event.daysUntil}d away
                        </div>
                        {event.price_per_slot > 0 && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            ${event.price_per_slot.toLocaleString()}/slot
                          </div>
                        )}
                      </div>

                      {/* Heat score */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 44, height: 44, borderRadius: '50%',
                          background: event.heatScore >= 70 ? 'var(--red-soft)' : event.heatScore >= 40 ? 'var(--yellow-soft)' : 'var(--blue-soft)',
                          border: `2px solid ${barColor}`,
                          fontWeight: 700, fontSize: 'var(--text-sm)', color: barColor,
                        }}>
                          {event.heatScore}
                        </div>
                      </div>
                    </div>

                    {/* Expanded: company candidates */}
                    {isExpanded && (
                      <div style={{ padding: '0 var(--space-6) var(--space-5)', background: 'var(--accent-soft)' }}>
                        {candidates.length === 0 ? (
                          <div style={{ padding: 'var(--space-4)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                            Loading candidates…
                          </div>
                        ) : (
                          <div className="table-wrapper" style={{ borderRadius: 'var(--radius-md)' }}>
                            <table>
                              <thead>
                                <tr>
                                  <th style={{ width: 30 }}>#</th>
                                  <th>Company</th>
                                  <th>Status</th>
                                  <th>Best Contact</th>
                                  <th>Warmth</th>
                                  <th>Last Touch</th>
                                  <th>Why</th>
                                </tr>
                              </thead>
                              <tbody>
                                {candidates.map((c, i) => (
                                  <tr key={c.id} onClick={() => router.push(`/companies/${c.id}`)}>
                                    <td style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{i + 1}</td>
                                    <td>
                                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{c.domain}</div>
                                    </td>
                                    <td><span className={`badge ${STATUS_BADGE[c.status] || 'badge-neutral'}`}>{c.status}</span></td>
                                    <td style={{ fontSize: 'var(--text-sm)' }}>{c.bestContactName}</td>
                                    <td><span className={`badge ${WARMTH_BADGE[c.bestWarmth] || 'badge-neutral'}`}>{c.bestWarmth}</span></td>
                                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                                      {c.lastInteractionDate
                                        ? new Date(c.lastInteractionDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                        : '—'}
                                      {c.lastInteractionSnippet && (
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                          {c.lastInteractionSnippet}
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>{c.reason}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── PIPELINE HEALTH ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>

        {/* Deals by Stage */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">💰 Pipeline by Stage</h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {deals.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon">💰</div>
                <div className="empty-state-title">No deals yet</div>
                <div className="empty-state-text">Create your first deal in Step 5</div>
              </div>
            ) : (
              <div>
                {['draft', 'prop_sent', 'prop_signed'].map(stage => {
                  const stageDeals = dealsByStage[stage] || [];
                  const stageTotal = stageDeals.reduce((s, d) => s + (d.amount || 0), 0);
                  return (
                    <div key={stage} style={{
                      padding: 'var(--space-4) var(--space-6)',
                      borderBottom: stage !== 'prop_signed' ? '1px solid var(--border-default)' : 'none',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: STAGE_COLOR[stage], flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{STAGE_LABELS[stage]}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            {stageDeals.length} deal{stageDeals.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>
                        ${stageTotal.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Stuck / Overdue Deals */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🚨 Needs Attention</h2>
            <span className={`badge ${(overdueDeals.length + stuckDeals.length) > 0 ? 'badge-red' : 'badge-green'}`}>
              {overdueDeals.length + stuckDeals.length}
            </span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {overdueDeals.length === 0 && stuckDeals.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                <div className="empty-state-title" style={{ color: 'var(--green)' }}>All clear 👍</div>
                <div className="empty-state-text">No overdue follow-ups or stuck deals</div>
              </div>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {overdueDeals.map(d => (
                  <div key={`overdue-${d.id}`} style={{
                    padding: 'var(--space-3) var(--space-6)',
                    borderBottom: '1px solid var(--border-default)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--red)' }}>
                        ⏰ {d.companies?.name || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        Follow-up was {new Date(d.follow_up_date! + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {d.events?.name && ` · ${d.events.name}`}
                      </div>
                    </div>
                    <span className="badge badge-red">Overdue</span>
                  </div>
                ))}
                {stuckDeals.filter(d => !overdueDeals.find(od => od.id === d.id)).map(d => (
                  <div key={`stuck-${d.id}`} style={{
                    padding: 'var(--space-3) var(--space-6)',
                    borderBottom: '1px solid var(--border-default)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {d.companies?.name || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {STAGE_LABELS[d.stage]} since {new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {d.events?.name && ` · ${d.events.name}`}
                      </div>
                    </div>
                    <span className="badge badge-yellow">Stuck</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RECENT ACTIVITY ── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📝 Recent Activity</h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Last 20 notes</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {recentNotes.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
              <div className="empty-state-icon">📝</div>
              <div className="empty-state-title">No activity yet</div>
              <div className="empty-state-text">Use Quick Note (⌘N) to capture your first interaction</div>
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {recentNotes.map(note => (
                <div key={note.id} style={{
                  padding: 'var(--space-4) var(--space-6)',
                  borderBottom: '1px solid var(--border-default)',
                  display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0,
                  }}>
                    {note.source?.slice(0, 2).toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {note.companies?.name || 'Unknown'}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {truncate(note.notes, 150)}
                    </div>
                    {note.follow_up && (
                      <div style={{
                        marginTop: 6, fontSize: 'var(--text-xs)', color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        → {note.follow_up}
                        {note.follow_up_date && (
                          <span style={{ color: 'var(--text-tertiary)' }}>
                            (by {new Date(note.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

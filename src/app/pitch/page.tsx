// app/pitch/page.tsx
// Screen 1: Pitch Engine — "Who to pitch what"
// Left: event selector with slot counts. Right: ranked contacts, filterable, with "Add to Wave" bulk action.

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  WARMTH_LABELS, WARMTH_COLORS,
  STATUS_LABELS, STATUS_COLORS,
  PERSONA_LABELS, FORMAT_LABELS,
} from '@/lib/supabase-types';

const supabase = createClient();

// ── Types ──

interface EventSlot {
  id: string;
  name: string;
  event_date: string | null;
  city: string | null;
  format: string;
  max_sponsors: number;
  price_per_slot: number | null;
  conference_id: string | null;
  sponsors_confirmed: number;
  slots_available: number;
  conference_name?: string;
}

interface PitchCandidate {
  contact_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  title: string | null;
  persona: string | null;
  warmth: string;
  seniority: string | null;
  company_id: string;
  company_name: string;
  company_status: string;
  conference_count: number;
  region: string | null;
}

// ── Main Page ──

export default function PitchEnginePage() {
  const [events, setEvents] = useState<EventSlot[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<PitchCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  // Filters
  const [personaFilter, setPersonaFilter] = useState('');
  const [warmthFilter, setWarmthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [minConferences, setMinConferences] = useState(0);

  // Wave selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [waveModalOpen, setWaveModalOpen] = useState(false);
  const [waveName, setWaveName] = useState('');
  const [waveSubmitting, setWaveSubmitting] = useState(false);

  // ── Load events with inventory ──
  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    // Get events with sponsor counts
    const { data: eventsData } = await supabase
      .from('events')
      .select(`
        id, name, event_date, city, format, max_sponsors, price_per_slot, conference_id,
        event_sponsors(id)
      `)
      .order('event_date', { ascending: true });

    if (eventsData) {
      const mapped: EventSlot[] = eventsData.map((e: any) => {
        const confirmed = Array.isArray(e.event_sponsors) ? e.event_sponsors.length : 0;
        return {
          id: e.id,
          name: e.name,
          event_date: e.event_date,
          city: e.city,
          format: e.format,
          max_sponsors: e.max_sponsors ?? 0,
          price_per_slot: e.price_per_slot,
          conference_id: e.conference_id,
          sponsors_confirmed: confirmed,
          slots_available: (e.max_sponsors ?? 0) - confirmed,
        };
      });

      // Only show events with available slots and future dates
      const available = mapped.filter(e =>
        e.slots_available > 0 &&
        (!e.event_date || new Date(e.event_date) >= new Date(new Date().toDateString()))
      );

      setEvents(available);

      // Auto-select first event
      if (available.length > 0 && !selectedEventId) {
        setSelectedEventId(available[0].id);
      }
    }
    setLoading(false);
  }

  // ── Load pitch candidates for selected event ──
  useEffect(() => {
    if (selectedEventId) {
      loadCandidates(selectedEventId);
    }
  }, [selectedEventId]);

  async function loadCandidates(eventId: string) {
    setCandidatesLoading(true);
    setSelected(new Set());

    // Get contacts already pitched for this event (via campaign_targets)
    const { data: campaignsForEvent } = await supabase
      .from('campaigns')
      .select('id')
      .eq('event_id', eventId);

    const campaignIds = campaignsForEvent?.map(c => c.id) || [];

    let alreadyPitchedContactIds: string[] = [];
    if (campaignIds.length > 0) {
      const { data: targets } = await supabase
        .from('campaign_targets')
        .select('contact_id')
        .in('campaign_id', campaignIds);
      alreadyPitchedContactIds = targets?.map(t => t.contact_id) || [];
    }

    // Also exclude companies that already sponsor this event
    const { data: existingSponsors } = await supabase
      .from('event_sponsors')
      .select('company_id')
      .eq('event_id', eventId);
    const sponsorCompanyIds = existingSponsors?.map(s => s.company_id) || [];

    // Get eligible contacts: warm+, at client/prospect/high_value companies, email not bounced
    const { data: contactsData } = await supabase
      .from('contacts')
      .select(`
        id, first_name, last_name, email, title, persona, warmth, seniority,
        company_id,
        companies!inner(id, name, status, conference_count, region)
      `)
      .in('companies.status', ['client', 'prospect', 'high_value'])
      .in('warmth', ['hot', 'warm', 'cool'])
      .neq('email_status', 'bounced')
      .order('warmth', { ascending: true });

    if (contactsData) {
      const mapped: PitchCandidate[] = contactsData
        .filter((c: any) => {
          // Exclude already-pitched contacts
          if (alreadyPitchedContactIds.includes(c.id)) return false;
          // Exclude companies already sponsoring this event
          if (sponsorCompanyIds.includes(c.company_id)) return false;
          return true;
        })
        .map((c: any) => ({
          contact_id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          title: c.title,
          persona: c.persona,
          warmth: c.warmth,
          seniority: c.seniority,
          company_id: c.companies.id,
          company_name: c.companies.name,
          company_status: c.companies.status,
          conference_count: c.companies.conference_count ?? 0,
          region: c.companies.region,
        }));

      // Sort: hot > warm > cool, then client > prospect > high_value, then by conference_count desc
      mapped.sort((a, b) => {
        const warmthOrder: Record<string, number> = { hot: 1, warm: 2, cool: 3 };
        const statusOrder: Record<string, number> = { client: 1, prospect: 2, high_value: 3 };
        const wDiff = (warmthOrder[a.warmth] ?? 9) - (warmthOrder[b.warmth] ?? 9);
        if (wDiff !== 0) return wDiff;
        const sDiff = (statusOrder[a.company_status] ?? 9) - (statusOrder[b.company_status] ?? 9);
        if (sDiff !== 0) return sDiff;
        return b.conference_count - a.conference_count;
      });

      setCandidates(mapped);
    }

    setCandidatesLoading(false);
  }

  // ── Filter candidates ──
  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (personaFilter && c.persona !== personaFilter) return false;
      if (warmthFilter && c.warmth !== warmthFilter) return false;
      if (statusFilter && c.company_status !== statusFilter) return false;
      if (regionFilter && c.region !== regionFilter) return false;
      if (c.conference_count < minConferences) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
        const company = c.company_name.toLowerCase();
        const email = (c.email ?? '').toLowerCase();
        if (!name.includes(q) && !company.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [candidates, personaFilter, warmthFilter, statusFilter, regionFilter, searchQuery, minConferences]);

  // ── Unique regions for filter ──
  const regions = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach(c => { if (c.region) set.add(c.region); });
    return Array.from(set).sort();
  }, [candidates]);

  // ── Selection handlers ──
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredCandidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredCandidates.map(c => c.contact_id)));
    }
  }

  // ── Add to Wave ──
  async function handleAddToWave() {
    if (!selectedEventId || selected.size === 0 || !waveName.trim()) return;
    setWaveSubmitting(true);

    try {
      // Create campaign
      const { data: campaign, error: campError } = await supabase
        .from('campaigns')
        .insert({
          event_id: selectedEventId,
          name: waveName.trim(),
          wave: 1,
        })
        .select()
        .single();

      if (campError || !campaign) throw campError;

      // Create campaign_targets
      const targets = Array.from(selected).map(contactId => ({
        campaign_id: campaign.id,
        contact_id: contactId,
        date_sent: new Date().toISOString().split('T')[0],
      }));

      const { error: targetsError } = await supabase
        .from('campaign_targets')
        .insert(targets);

      if (targetsError) throw targetsError;

      // Refresh candidates (pitched contacts will be excluded)
      setWaveModalOpen(false);
      setWaveName('');
      await loadCandidates(selectedEventId);
    } catch (err) {
      console.error('Failed to add to wave:', err);
      alert('Failed to create wave. Check console for details.');
    }

    setWaveSubmitting(false);
  }

  // ── Selected event ──
  const selectedEvent = events.find(e => e.id === selectedEventId);

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
        Loading events…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 'calc(100dvh - 60px)' }}>
      {/* ── Left Panel: Event Selector ── */}
      <div style={{
        width: 320,
        flexShrink: 0,
        borderRight: '1px solid var(--border-default)',
        background: 'var(--bg-subtle)',
        overflowY: 'auto',
        padding: 'var(--space-5)',
      }}>
        <h2 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 700,
          marginBottom: 'var(--space-4)',
          color: 'var(--text-primary)',
        }}>
          Events with Open Slots
        </h2>

        {events.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            All events are fully booked or past.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {events.map(ev => {
              const isSelected = ev.id === selectedEventId;
              const pct = ev.max_sponsors > 0 ? (ev.sponsors_confirmed / ev.max_sponsors) * 100 : 0;
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  style={{
                    textAlign: 'left',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    border: isSelected
                      ? '2px solid var(--accent-primary)'
                      : '1px solid var(--border-default)',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <div style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--space-1)',
                  }}>
                    {ev.name}
                  </div>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    {ev.event_date ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    }) : 'TBD'}
                    {ev.city ? ` · ${ev.city}` : ''}
                    {' · '}
                    <span className={`badge badge-${ev.format === 'dinner' ? 'blue' : ev.format === 'breakfast' ? 'yellow' : ev.format === 'shark_tank' ? 'purple' : 'gray'}`}>
                      {FORMAT_LABELS[ev.format] ?? ev.format}
                    </span>
                  </div>
                  {/* Slot bar */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
                  }}>
                    <div style={{
                      flex: 1, height: 6, borderRadius: 3,
                      background: 'var(--border-default)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: 3,
                        background: pct >= 80 ? 'var(--color-green)' : pct >= 40 ? 'var(--color-yellow)' : 'var(--color-red)',
                        transition: 'width 0.2s ease',
                      }} />
                    </div>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      {ev.slots_available} open / {ev.max_sponsors}
                    </span>
                  </div>
                  {ev.price_per_slot && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                      ${ev.price_per_slot.toLocaleString()}/slot
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right Panel: Candidates ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5) var(--space-6)' }}>
        {selectedEvent ? (
          <>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              marginBottom: 'var(--space-5)',
              flexWrap: 'wrap', gap: 'var(--space-3)',
            }}>
              <div>
                <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Pitch Candidates for {selectedEvent.name}
                </h1>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                  {filteredCandidates.length} contacts available · {selected.size} selected
                </p>
              </div>
              {selected.size > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setWaveName(`${selectedEvent.name} Wave`);
                    setWaveModalOpen(true);
                  }}
                >
                  Add {selected.size} to Wave →
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="filters-row" style={{ marginBottom: 'var(--space-4)' }}>
              <input
                className="input"
                placeholder="Search name, company, email…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ minWidth: 220 }}
              />
              <select className="input select" value={warmthFilter} onChange={e => setWarmthFilter(e.target.value)}>
                <option value="">All Warmth</option>
                <option value="hot">🔥 Hot</option>
                <option value="warm">☀️ Warm</option>
                <option value="cool">❄️ Cool</option>
              </select>
              <select className="input select" value={personaFilter} onChange={e => setPersonaFilter(e.target.value)}>
                <option value="">All Personas</option>
                {Object.entries(PERSONA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select className="input select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Company Status</option>
                <option value="client">Client</option>
                <option value="prospect">Prospect</option>
                <option value="high_value">High Value</option>
              </select>
              <select className="input select" value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
                <option value="">All Regions</option>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                className="input select"
                value={minConferences}
                onChange={e => setMinConferences(Number(e.target.value))}
              >
                <option value={0}>Any Conf Count</option>
                <option value={3}>3+ Conferences</option>
                <option value={5}>5+ Conferences</option>
                <option value={8}>8+ Conferences</option>
                <option value={10}>10+ Conferences</option>
              </select>
            </div>

            {/* Table */}
            {candidatesLoading ? (
              <p style={{ color: 'var(--text-tertiary)', padding: 'var(--space-8)' }}>Loading candidates…</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={filteredCandidates.length > 0 && selected.size === filteredCandidates.length}
                        onChange={toggleSelectAll}
                        style={{ width: 18, height: 18 }}
                      />
                    </th>
                    <th>Contact</th>
                    <th>Company</th>
                    <th>Persona</th>
                    <th>Warmth</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Conf #</th>
                    <th>Region</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.slice(0, 200).map(c => (
                    <tr
                      key={c.contact_id}
                      style={{
                        background: selected.has(c.contact_id) ? 'var(--accent-soft)' : undefined,
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleSelect(c.contact_id)}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(c.contact_id)}
                          onChange={() => toggleSelect(c.contact_id)}
                          style={{ width: 18, height: 18 }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {c.first_name} {c.last_name}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                          {c.title}
                        </div>
                        {c.email && (
                          <div style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-tertiary)',
                            fontFamily: 'monospace',
                          }}>
                            {c.email}
                          </div>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/companies/${c.company_id}`}
                          onClick={e => e.stopPropagation()}
                          style={{ fontWeight: 500, color: 'var(--accent-primary)', textDecoration: 'none' }}
                        >
                          {c.company_name}
                        </Link>
                      </td>
                      <td>
                        {c.persona ? (
                          <span className="badge badge-gray">
                            {PERSONA_LABELS[c.persona] ?? c.persona}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`badge badge-${WARMTH_COLORS[c.warmth] ?? 'gray'}`}>
                          {WARMTH_LABELS[c.warmth] ?? c.warmth}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${STATUS_COLORS[c.company_status] ?? 'gray'}`}>
                          {STATUS_LABELS[c.company_status] ?? c.company_status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {c.conference_count}
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        {c.region ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {filteredCandidates.length > 200 && (
              <p style={{
                textAlign: 'center',
                padding: 'var(--space-4)',
                color: 'var(--text-tertiary)',
                fontSize: 'var(--text-sm)',
              }}>
                Showing 200 of {filteredCandidates.length}. Use filters to narrow results.
              </p>
            )}

            {filteredCandidates.length === 0 && !candidatesLoading && (
              <p style={{
                textAlign: 'center',
                padding: 'var(--space-8)',
                color: 'var(--text-tertiary)',
              }}>
                No pitch candidates match current filters. Try broadening your search.
              </p>
            )}
          </>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--text-tertiary)',
          }}>
            <p>← Select an event to see pitch candidates</p>
          </div>
        )}
      </div>

      {/* ── Wave Modal ── */}
      {waveModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'var(--bg-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setWaveModalOpen(false); }}
        >
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-8)',
            width: '100%',
            maxWidth: 480,
            boxShadow: 'var(--shadow-xl)',
          }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-5)' }}>
              Add to Wave
            </h2>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              Creating a campaign for <strong>{selectedEvent?.name}</strong> with{' '}
              <strong>{selected.size} contacts</strong>. They'll be marked as pitched and excluded from future
              candidate lists for this event.
            </p>

            <label style={{
              fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)',
              display: 'block', marginBottom: 'var(--space-1)',
            }}>
              Wave Name
            </label>
            <input
              className="input"
              value={waveName}
              onChange={e => setWaveName(e.target.value)}
              placeholder="e.g. California Dreaming Wave 1"
              style={{ marginBottom: 'var(--space-5)' }}
            />

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setWaveModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={waveSubmitting || !waveName.trim()}
                onClick={handleAddToWave}
              >
                {waveSubmitting ? 'Creating…' : `Create Wave (${selected.size} contacts)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

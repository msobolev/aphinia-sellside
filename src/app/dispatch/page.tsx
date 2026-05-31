// src/app/dispatch/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { WARMTH_LABELS, WARMTH_COLORS, PERSONA_LABELS } from '@/lib/supabase-types';

const supabase = createClient();

// ═══ TEMPLATES ═══
const TEMPLATES = [
  { id: 'dc-init-city', track: 'Dinner Cold', name: 'Initial outreach (standalone)',
    subj: '{CITY} CISO dinner - {DS}',
    body: `Hi {FirstName},

I run Aphinia — a private community of 2,000+ CISOs and senior security executives.

We're hosting a CISO Mastermind dinner in {CITY} on {DATE} — {CAP} senior security leaders around one table for a candid, off-the-record conversation. No presentations, no panels. Just practitioners talking about what's actually working.

We have one sponsorship slot available. Your team gets a seat at the table alongside the CISOs — not a speaking slot, but something better: a real conversation with decision-makers in a setting where they're actually listening.

Past dinners have included CISOs and VPs of Security from {STATS}.

Want me to send the details?

Misha Sobolev
Aphinia` },

  { id: 'dc-init-conf', track: 'Dinner Cold', name: 'Initial outreach (conference)',
    subj: '{CONF} - CISO dinner sponsorship',
    body: `Hi {FirstName},

Are you exhibiting at {CONF}?

We're hosting a private CISO Mastermind dinner on {DATE} around the conference — {CAP} senior security leaders, closed-door, off-the-record. No presentations. Just a candid conversation among practitioners.

We have a sponsorship slot open. Your team gets a seat at the table with the CISOs — the same people who won't stop at your booth but will sit down for a 3-hour dinner with peers.

Interested in the details?

Misha Sobolev
Aphinia` },

  { id: 'dc-social', track: 'Dinner Cold', name: 'Social proof follow-up',
    subj: 're: {CITY} dinner',
    body: `Hi {FirstName},

Quick follow-up on the {CITY} CISO dinner on {DATE}.

The table is filling up — confirmed so far:

{ATTENDEES}

{Company} would be a strong fit in this room given your focus on {SOLUTION}.

Want me to send the sponsorship deck?

Misha Sobolev
Aphinia` },

  { id: 'dc-scarcity', track: 'Dinner Cold', name: 'Scarcity close',
    subj: '{CITY} dinner - one slot left',
    body: `Hi {FirstName},

The {CITY} CISO dinner on {DATE} is nearly full. We have one sponsorship slot remaining.

The room: {STATS}.

The format: 3-hour private dinner. No slides, no pitches. Your team sits at the table as peers, not presenters. You get the full attendee list and warm intros to anyone you want to follow up with.

{PRICE} for the slot. If {Company} wants in, I need to know this week.

Misha Sobolev
Aphinia` },

  { id: 'dw-reengage', track: 'Dinner Warm', name: 'Re-engage prior sponsor',
    subj: '{CITY} dinner - {DS}',
    body: `Hi {FirstName},

We're hosting the next CISO Mastermind dinner in {CITY} on {DATE} and I wanted to give {Company} first look at sponsorship before I open it up.

Same format you know — {CAP} senior security leaders, closed-door, off-the-record conversation. Your team gets a seat at the table, full attendee list, and post-dinner intros.

Want to lock it in?

Misha Sobolev
Aphinia` },

  { id: 'dw-crosssell', track: 'Dinner Warm', name: 'Calendar cross-sell',
    subj: '{Company} + Aphinia — rest of year',
    body: `Hi {FirstName},

Since {Company} had a good experience at the last dinner, wanted to share the rest of the calendar:

{CITIES}

Most cities have exclusive and co-sponsor slots open. Several sell out 6-8 weeks before the event.

Want to pick a few cities? I can send the deck with attendee profiles for each.

Misha Sobolev
Aphinia` },

  { id: 'df-nudge', track: 'Dinner Follow-up', name: 'Post-deck nudge',
    subj: '{FirstName} / the deck',
    body: `Hi {FirstName},

Did you get a chance to look at the {CITY} dinner deck?

Happy to jump on a 10-minute call to walk through the attendee profile and answer any questions.

Misha Sobolev
Aphinia` },

  { id: 'df-decision', track: 'Dinner Follow-up', name: 'Decision push',
    subj: '{CITY} dinner - decision',
    body: `Hi {FirstName},

Circling back on the {CITY} sponsorship. I have another vendor interested in the slot, so I wanted to check — is {Company} in or should I open it up?

No pressure either way. Just want to make sure you have the option before it's gone.

Misha Sobolev
Aphinia` },

  { id: 'dp-thankyou', track: 'Dinner Post-event', name: 'Sponsor thank you + upsell',
    subj: '{FirstName} / thank you',
    body: `Hi {FirstName},

Thank you for sponsoring the {CITY} dinner — I hope your team found the conversations valuable.

A few things:

1. Attendee list with full titles and companies is attached. If there's anyone specific you'd like a warm intro to, let me know and I'll make the connection.

2. Our next dinners are coming up:

{CITIES}

Several of the CISOs from last night attend dinners in other cities too. Sponsoring multiple cities compounds the relationship.

3. If your team is interested in more structured access, our briefing program puts you in 1-on-1 conversations with CISOs who match your target profile — {PKG} briefings for {PRICE}. Different format, same trust-based access.

Let me know what makes sense for {Company}.

Misha Sobolev
Aphinia` },

  { id: 'bc-init', track: 'Briefing Cold', name: 'Initial outreach',
    subj: '{Company} + Aphinia CISOs',
    body: `Hi {FirstName},

I run Aphinia — a private community of 2,000+ CISOs and senior security executives.

We have a briefing program that connects vendors with CISOs for 1-on-1 conversations. Not cold outreach — these are warm introductions through a community the CISOs trust.

For {Company}, I'd target {TARGET} — the CISOs who are actively evaluating {SOLUTION} solutions.

The package: {PKG} qualified briefings for {PRICE}. We handle outreach, warming, and scheduling. Your team shows up to a conversation with a decision-maker who agreed to take the call because we asked.

Companies like {COMPETITORS} have used this to get in front of buyers they couldn't reach any other way.

Worth a conversation?

Misha Sobolev
Aphinia` },

  { id: 'bc-proof', track: 'Briefing Cold', name: 'Value proof follow-up',
    subj: 'how Aphinia briefings work',
    body: `Hi {FirstName},

Quick follow-up — here's what the briefing program looks like in practice:

{PROOF}

The difference from standard outbound: these CISOs are community members who trust Aphinia. When we say "this vendor is worth 30 minutes of your time," they listen. That's not something an SDR sequence can replicate.

If this is relevant for {Company}, I can walk you through the targeting and process in 15 minutes.

Misha Sobolev
Aphinia` },

  { id: 'bw-renewal', track: 'Briefing Warm', name: 'Renewal outreach',
    subj: '{Company} briefings — next round',
    body: `Hi {FirstName},

Your current briefing package is nearly complete — {PROOF}.

Want to discuss the next round? We can adjust targeting, expand to new segments, or keep the same profile.

I can also pair briefings with a dinner sponsorship if {Company} wants to layer in the group setting. Several vendors run both and find the combination is what accelerates deals.

Let me know.

Misha Sobolev
Aphinia` },

  { id: 'bf-nudge', track: 'Briefing Follow-up', name: 'Post-proposal nudge',
    subj: '{FirstName} / briefing program',
    body: `Hi {FirstName},

Checking in on the briefing program proposal. Any questions I can answer?

If budget timing is the issue, we can structure it across quarters. The CISOs aren't going anywhere — but starting sooner means conversations while they're mid-evaluation, not after they've already shortlisted.

Misha Sobolev
Aphinia` },

  { id: 'bp-results', track: 'Briefing Post', name: 'Results + upsell',
    subj: '{Company} briefing results',
    body: `Hi {FirstName},

Your briefing package is complete. Here's the summary:

{PROOF}

Two options from here:

1. Next round — same or adjusted targeting, {PKG} briefings for {PRICE}. We can start as soon as next week.

2. Dinner sponsorship — put {Company} in a room with 15-25 of these CISOs for a 3-hour private dinner. Several of the CISOs from your briefings attend our dinners. Sponsorship starts at {PRICE}.

What makes sense for {Company}?

Misha Sobolev
Aphinia` },
];

const TRACK_COLORS: Record<string, string> = {
  'Dinner Cold': '#0C447C', 'Dinner Warm': '#6B3FA0', 'Dinner Follow-up': '#B45309',
  'Dinner Post-event': '#065F46', 'Briefing Cold': '#1E40AF', 'Briefing Warm': '#7C3AED',
  'Briefing Follow-up': '#C2410C', 'Briefing Post': '#047857',
};
const TRACK_BGS: Record<string, string> = {
  'Dinner Cold': '#E6F1FB', 'Dinner Warm': '#F0EAFA', 'Dinner Follow-up': '#FEF3C7',
  'Dinner Post-event': '#D1FAE5', 'Briefing Cold': '#DBEAFE', 'Briefing Warm': '#EDE9FE',
  'Briefing Follow-up': '#FFF7ED', 'Briefing Post': '#ECFDF5',
};

function mergeTemplate(tpl: typeof TEMPLATES[0], contact: any, vars: Record<string, string>) {
  let subj = tpl.subj;
  let body = tpl.body;
  const replacements: Record<string, string> = {
    '{FirstName}': contact.first_name || '{FirstName}',
    '{Company}': contact.company?.name || '{Company}',
    '{Title}': contact.title || '{Title}',
    ...vars,
  };
  Object.entries(replacements).forEach(([k, v]) => {
    subj = subj.split(k).join(v || k);
    body = body.split(k).join(v || k);
  });
  return { subj, body };
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr + 'T12:00:00').getTime() - Date.now()) / 86400000);
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000);
}

function urgencyLabel(days: number): { label: string; color: string; bg: string } {
  if (days <= 30) return { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' };
  if (days <= 60) return { label: 'Urgent', color: '#D97706', bg: '#FFFBEB' };
  return { label: 'Watch', color: '#16A34A', bg: '#F0FDF4' };
}

function suggestTemplate(deal: any): typeof TEMPLATES[0] {
  const daysSinceSent = daysSince(deal.sent_date);
  if (!deal.sent_date) return TEMPLATES.find(t => t.id === 'dc-init-city')!;
  if (daysSinceSent && daysSinceSent > 7) return TEMPLATES.find(t => t.id === 'df-nudge')!;
  return TEMPLATES.find(t => t.id === 'df-decision')!;
}

type Step = 'queue' | 'search' | 'template' | 'preview';

export default function DispatchPage() {
  const [step, setStep] = useState<Step>('queue');
  const [contacts, setContacts] = useState<any[]>([]);
  const [priorityDeals, setPriorityDeals] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [personaFilter, setPersonaFilter] = useState('');
  const [warmthFilter, setWarmthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Record<string, any>>({});
  const [tplId, setTplId] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [vars, setVars] = useState<Record<string, string>>({
    '{CITY}': '', '{DATE}': '', '{DS}': '', '{CONF}': '', '{PRICE}': '$15,000',
    '{PKG}': '20', '{CAP}': '15', '{ATTENDEES}': '', '{STATS}': '',
    '{TOPIC}': '', '{SOLUTION}': '', '{TARGET}': '', '{PROOF}': '',
    '{COMPETITORS}': '', '{CITIES}': '', '{DECK}': '',
  });
  const [drafting, setDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const selectedCount = Object.keys(selected).length;
  const tpl = TEMPLATES.find(t => t.id === tplId);

  // ── Load priority queue ──
  useEffect(() => {
    async function loadQueue() {
      setLoadingQueue(true);
      const { data } = await supabase
        .from('deals')
        .select('*, companies(id, name), contacts(id, first_name, last_name, email, title), events(id, name, event_date, city)')
        .eq('status', 'prop_sent')
        .order('created_at', { ascending: true });

      if (data) {
        const enriched = data
          .filter((d: any) => d.events?.event_date)
          .map((d: any) => ({
            ...d,
            days_until_event: daysUntil(d.events.event_date),
            days_since_sent: daysSince(d.sent_date),
            suggested_template: suggestTemplate(d),
          }))
          .sort((a: any, b: any) => a.days_until_event - b.days_until_event);
        setPriorityDeals(enriched);
      }
      setLoadingQueue(false);
    }
    loadQueue();
  }, []);

  // ── Load contacts for search tab ──
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('contacts')
      .select('*, company:companies(id, name, status)')
      .order('last_name', { ascending: true })
      .limit(100);
    if (personaFilter) query = query.eq('persona', personaFilter);
    if (warmthFilter) query = query.eq('warmth', warmthFilter);
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data } = await query;
    if (data) {
      let filtered = data.filter((c: any) => c.email);
      if (statusFilter) filtered = filtered.filter((c: any) => c.company?.status === statusFilter);
      setContacts(filtered);
    }
    setLoading(false);
  }, [search, personaFilter, warmthFilter, statusFilter]);

  useEffect(() => { if (step === 'search') fetchContacts(); }, [fetchContacts, step]);

  const toggleSelect = (c: any) => {
    setSelected(prev => {
      const n = { ...prev };
      if (n[c.id]) delete n[c.id];
      else n[c.id] = c;
      return n;
    });
  };

  const selectFromDeal = (deal: any) => {
    if (!deal.contacts) return;
    const contact = { ...deal.contacts, company: deal.companies };
    setSelected({ [contact.id]: contact });
    setTplId(deal.suggested_template.id);
    // Pre-fill city and date vars
    if (deal.events?.city) setVars(v => ({ ...v, '{CITY}': deal.events.city }));
    if (deal.events?.event_date) {
      const d = new Date(deal.events.event_date + 'T12:00:00');
      const display = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const short = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setVars(v => ({ ...v, '{DATE}': display, '{DS}': short }));
    }
    setStep('template');
  };

  const filteredTemplates = trackFilter ? TEMPLATES.filter(t => t.track === trackFilter) : TEMPLATES;
  const tracks = [...new Set(TEMPLATES.map(t => t.track))];

  const createDrafts = async () => {
    if (!tpl) return;
    setDrafting(true);
    setDraftResult(null);
    const drafts = Object.values(selected).map(contact => {
      const merged = mergeTemplate(tpl, contact, vars);
      return { to: contact.email, subject: merged.subj, body: merged.body };
    });
    try {
      const res = await fetch('/api/draft-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drafts }),
      });
      const data = await res.json();
      setDraftResult(data);
    } catch (err: any) {
      setDraftResult({ error: err.message });
    }
    setDrafting(false);
  };

  const copyEmail = (subj: string, body: string, key: string) => {
    navigator.clipboard.writeText(`Subject: ${subj}\n\n${body}`);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="page-title">Dispatch</h1>
        <p className="page-subtitle">Priority queue → Select → Template → Gmail drafts</p>
      </div>

      {/* Step tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--space-5)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxWidth: 700 }}>
        {[
          { key: 'queue', label: '① Priority Queue', always: true },
          { key: 'search', label: '② Search & Select', always: true },
          { key: 'template', label: '③ Template', always: false },
          { key: 'preview', label: '④ Preview & Draft', always: false },
        ].map((s, i) => {
          const enabled = s.always || selectedCount > 0;
          const active = step === s.key;
          return (
            <button key={s.key} onClick={() => enabled && setStep(s.key as Step)}
              style={{
                flex: 1, padding: '10px 12px', border: 'none',
                borderLeft: i > 0 ? '1px solid var(--border-default)' : 'none',
                fontSize: 'var(--text-sm)', fontWeight: active ? 700 : 500,
                background: active ? 'var(--accent-soft)' : 'var(--bg-card)',
                color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                cursor: enabled ? 'pointer' : 'not-allowed',
                opacity: enabled ? 1 : 0.4, fontFamily: 'inherit',
              }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-sidebar)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        <span><strong style={{ color: 'var(--accent)' }}>{selectedCount}</strong> contacts selected</span>
        {tpl && <span>· Template: <strong>{tpl.name}</strong></span>}
        {selectedCount > 0 && (
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelected({})}>Clear all</button>
        )}
      </div>

      {/* ═══ STEP: PRIORITY QUEUE ═══ */}
      {step === 'queue' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
              Open proposals ranked by event proximity. Click any row to pre-load contact + template.
            </p>
          </div>

          {loadingQueue ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
          ) : priorityDeals.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 600 }}>No open proposals</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>All proposals are closed or signed.</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Urgency</th>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Event</th>
                    <th style={{ textAlign: 'right' }}>Days Out</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Prop Sent</th>
                    <th>Suggested Action</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {priorityDeals.map((deal: any) => {
                    const urgency = urgencyLabel(deal.days_until_event);
                    const sentAgo = deal.days_since_sent;
                    return (
                      <tr key={deal.id} style={{ cursor: 'pointer' }} onClick={() => selectFromDeal(deal)}>
                        <td>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 'var(--text-xs)', fontWeight: 700, background: urgency.bg, color: urgency.color }}>
                            {urgency.label}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{deal.companies?.name || '—'}</td>
                        <td style={{ fontSize: 'var(--text-sm)' }}>
                          {deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : '—'}
                          {deal.contacts?.email && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{deal.contacts.email}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 'var(--text-sm)' }}>
                          {deal.events?.city || '—'}
                          {deal.events?.event_date && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                              {new Date(deal.events.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: urgency.color }}>
                          {deal.days_until_event}d
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          ${(deal.amount || 0).toLocaleString()}
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: sentAgo && sentAgo > 14 ? 'var(--red)' : 'var(--text-secondary)' }}>
                          {sentAgo != null ? `${sentAgo}d ago` : <span style={{ color: 'var(--text-tertiary)' }}>Not sent</span>}
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)' }}>
                          <span style={{ background: TRACK_BGS[deal.suggested_template.track], color: TRACK_COLORS[deal.suggested_template.track], padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>
                            {deal.suggested_template.name}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); selectFromDeal(deal); }}>
                            Draft →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP: SEARCH ═══ */}
      {step === 'search' && (
        <div>
          <div className="filters-row" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ flex: '1 1 300px', maxWidth: 400 }}>
              <input className="input" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input select" style={{ width: 180 }} value={personaFilter} onChange={e => setPersonaFilter(e.target.value)}>
              <option value="">All Personas</option>
              {['cmo_cro', 'field_marketing', 'demand_gen', 'events', 'channel_alliance', 'director_marketing', 'marketing_other', 'regional_sales'].map(p =>
                <option key={p} value={p}>{PERSONA_LABELS[p]}</option>
              )}
            </select>
            <select className="input select" style={{ width: 140 }} value={warmthFilter} onChange={e => setWarmthFilter(e.target.value)}>
              <option value="">All Warmth</option>
              {['hot', 'warm', 'cool', 'cold'].map(w => <option key={w} value={w}>{WARMTH_LABELS[w]}</option>)}
            </select>
            <select className="input select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Companies</option>
              <option value="client">Client</option>
              <option value="prospect">Prospect</option>
              <option value="high_value">High Value</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={() => { const n = { ...selected }; contacts.forEach(c => { n[c.id] = c; }); setSelected(n); }}>
              Select all visible
            </button>
          </div>

          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>
            {loading ? 'Loading…' : `${contacts.length} contacts`}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', maxHeight: 500 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>Name</th>
                    <th>Title</th>
                    <th>Persona</th>
                    <th>Company</th>
                    <th>Warmth</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => {
                    const isSel = !!selected[c.id];
                    const wColor = WARMTH_COLORS[c.warmth as keyof typeof WARMTH_COLORS] || 'var(--gray)';
                    return (
                      <tr key={c.id} onClick={() => toggleSelect(c)} style={{ cursor: 'pointer', background: isSel ? 'var(--accent-soft)' : undefined }}>
                        <td><input type="checkbox" checked={isSel} onChange={() => {}} style={{ width: 16, height: 16, cursor: 'pointer' }} /></td>
                        <td style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{c.first_name} {c.last_name}</td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || '—'}</td>
                        <td>{c.persona ? <span className="badge badge-blue" style={{ fontSize: 'var(--text-xs)' }}>{PERSONA_LABELS[c.persona] || c.persona}</span> : '—'}</td>
                        <td style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{c.company?.name || '—'}</td>
                        <td><span className="badge" style={{ background: `${wColor}14`, color: wColor }}>{WARMTH_LABELS[c.warmth] || c.warmth}</span></td>
                        <td style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{c.email}</td>
                      </tr>
                    );
                  })}
                  {!loading && contacts.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-tertiary)' }}>No contacts match your filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedCount > 0 && (
            <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setStep('template')}>Next: Choose template →</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP: TEMPLATE ═══ */}
      {step === 'template' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter:</span>
            <button className={`btn btn-sm ${!trackFilter ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTrackFilter('')}>All</button>
            {tracks.map(t => (
              <button key={t} className={`btn btn-sm ${trackFilter === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTrackFilter(t)}
                style={trackFilter === t ? { background: TRACK_COLORS[t], borderColor: TRACK_COLORS[t] } : {}}>
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {filteredTemplates.map(t => (
              <div key={t.id} className="card" onClick={() => setTplId(t.id)}
                style={{
                  cursor: 'pointer', padding: 'var(--space-4)',
                  borderColor: tplId === t.id ? 'var(--accent)' : 'var(--border-default)',
                  borderWidth: tplId === t.id ? 2 : 1,
                  borderLeftWidth: 3, borderLeftColor: TRACK_COLORS[t.track],
                  boxShadow: tplId === t.id ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <span className="badge" style={{ background: TRACK_BGS[t.track], color: TRACK_COLORS[t.track], fontSize: 'var(--text-xs)' }}>{t.track}</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{t.name}</span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{t.subj}</div>
              </div>
            ))}
          </div>

          {tplId && (
            <>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Campaign variables</h2>
              <div className="card" style={{ padding: 'var(--space-5)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                  {[
                    ['{CITY}', 'City', 'e.g. Chicago'],
                    ['{DATE}', 'Event date (display)', 'e.g. Tuesday, October 7, 2026'],
                    ['{DS}', 'Short date', 'e.g. Oct 7'],
                    ['{CONF}', 'Conference', 'e.g. RSA Conference'],
                    ['{PRICE}', 'Price', '$15,000'],
                    ['{CAP}', 'Capacity', '15'],
                    ['{SOLUTION}', 'Solution area', 'e.g. cloud security'],
                    ['{TARGET}', 'Target CISO profile', 'e.g. enterprise CISOs in finserv'],
                    ['{PKG}', 'Package size', '20'],
                  ].map(([key, label, placeholder]) => (
                    <div key={key}>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>{label}</label>
                      <input className="input" value={vars[key]} onChange={e => setVars(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} />
                    </div>
                  ))}
                </div>
                <details style={{ marginTop: 'var(--space-4)' }}>
                  <summary style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}>More variables</summary>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                    {[
                      ['{ATTENDEES}', 'Confirmed attendees', '- CISO, Company', true],
                      ['{STATS}', 'Past stats', '23 CISOs from JPMorgan…', true],
                      ['{PROOF}', 'Proof points', '20/20 briefings completed…', true],
                      ['{CITIES}', 'Cities remaining', '- Chicago, Oct 20', true],
                    ].map(([key, label, placeholder, multi]) => (
                      <div key={key}>
                        <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>{label}</label>
                        {multi ? (
                          <textarea className="input" rows={3} value={vars[key as string]} onChange={e => setVars(p => ({ ...p, [key as string]: e.target.value }))} placeholder={placeholder as string} style={{ resize: 'vertical' }} />
                        ) : (
                          <input className="input" value={vars[key as string]} onChange={e => setVars(p => ({ ...p, [key as string]: e.target.value }))} placeholder={placeholder as string} />
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
              <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-secondary" onClick={() => setStep('search')}>← Back</button>
                <button className="btn btn-primary" onClick={() => setStep('preview')}>Preview {selectedCount} email{selectedCount !== 1 ? 's' : ''} →</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ STEP: PREVIEW ═══ */}
      {step === 'preview' && tpl && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>
              Preview — {selectedCount} email{selectedCount !== 1 ? 's' : ''}
            </h2>
            <button className="btn btn-primary" onClick={createDrafts} disabled={drafting}
              style={{ background: 'var(--green)', borderColor: 'var(--green)' }}>
              {drafting ? 'Creating drafts…' : `✉ Create ${selectedCount} Gmail draft${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>

          {draftResult && (
            <div className="card" style={{
              marginBottom: 'var(--space-5)', padding: 'var(--space-4)',
              background: draftResult.error ? '#FEF2F2' : '#F0FDF4',
              borderColor: draftResult.error ? 'var(--red)' : 'var(--green)',
            }}>
              {draftResult.error ? (
                <span style={{ color: 'var(--red)', fontWeight: 600 }}>Error: {draftResult.error}</span>
              ) : (
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                  ✓ {draftResult.successCount}/{draftResult.totalCount} drafts created in Gmail
                </span>
              )}
            </div>
          )}

          {Object.values(selected).map((contact: any) => {
            const merged = mergeTemplate(tpl, contact, vars);
            return (
              <div key={contact.id} className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)', borderLeftWidth: 3, borderLeftColor: TRACK_COLORS[tpl.track] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{contact.first_name} {contact.last_name}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 'var(--space-2)' }}>{contact.title}, {contact.company?.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{contact.email}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => copyEmail(merged.subj, merged.body, contact.id)}>
                      {copied === contact.id ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>Subject:</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-3)' }}>{merged.subj}</div>
                <div style={{ fontSize: 'var(--text-xs)', whiteSpace: 'pre-wrap', lineHeight: 1.65, fontFamily: 'var(--font-mono)', background: 'var(--bg-sidebar)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', maxHeight: 300, overflowY: 'auto' }}>
                  {merged.body}
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep('template')}>← Back to template</button>
            <button className="btn btn-primary" onClick={createDrafts} disabled={drafting}
              style={{ background: 'var(--green)', borderColor: 'var(--green)' }}>
              {drafting ? 'Creating drafts…' : `✉ Create ${selectedCount} Gmail draft${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

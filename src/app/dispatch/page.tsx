// src/app/dispatch/page.tsx
// Dispatch: Search contacts → Select → Pick template → Fill variables → Create Gmail drafts

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { WARMTH_LABELS, WARMTH_COLORS, PERSONA_LABELS } from '@/lib/supabase-types';

const supabase = createClient();

// ═══ SELLSIDE TEMPLATES (synced with Netlify Sellside Engine) ═══
const TEMPLATES = [
  // DINNER COLD
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

  // DINNER WARM
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

  // DINNER FOLLOW-UP
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

  // DINNER POST-EVENT
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

  // BRIEFING COLD
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

  // BRIEFING WARM
  { id: 'bw-renewal', track: 'Briefing Warm', name: 'Renewal outreach',
    subj: '{Company} briefings — next round',
    body: `Hi {FirstName},

Your current briefing package is nearly complete — {PROOF}.

Want to discuss the next round? We can adjust targeting, expand to new segments, or keep the same profile.

I can also pair briefings with a dinner sponsorship if {Company} wants to layer in the group setting. Several vendors run both and find the combination is what accelerates deals.

Let me know.

Misha Sobolev
Aphinia` },

  // BRIEFING FOLLOW-UP
  { id: 'bf-nudge', track: 'Briefing Follow-up', name: 'Post-proposal nudge',
    subj: '{FirstName} / briefing program',
    body: `Hi {FirstName},

Checking in on the briefing program proposal. Any questions I can answer?

If budget timing is the issue, we can structure it across quarters. The CISOs aren't going anywhere — but starting sooner means conversations while they're mid-evaluation, not after they've already shortlisted.

Misha Sobolev
Aphinia` },

  // BRIEFING POST
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

type Step = 'search' | 'template' | 'preview';

export default function DispatchPage() {
  const [step, setStep] = useState<Step>('search');

  // Search state
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [personaFilter, setPersonaFilter] = useState('');
  const [warmthFilter, setWarmthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Record<string, any>>({}); // keyed by contact id

  // Template state
  const [tplId, setTplId] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [vars, setVars] = useState<Record<string, string>>({
    '{CITY}': '', '{DATE}': '', '{DS}': '', '{CONF}': '', '{PRICE}': '$15,000',
    '{PKG}': '20', '{CAP}': '15', '{ATTENDEES}': '', '{STATS}': '',
    '{TOPIC}': '', '{SOLUTION}': '', '{TARGET}': '', '{PROOF}': '',
    '{COMPETITORS}': '', '{CITIES}': '', '{DECK}': '',
  });

  // Draft state
  const [drafting, setDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const selectedCount = Object.keys(selected).length;
  const tpl = TEMPLATES.find(t => t.id === tplId);

  // Fetch contacts from Supabase
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('contacts')
      .select('*, company:companies(id, name, status)')
      .order('last_name', { ascending: true })
      .limit(100);

    if (personaFilter) query = query.eq('persona', personaFilter);
    if (warmthFilter) query = query.eq('warmth', warmthFilter);
    if (statusFilter) query = query.eq('company.status', statusFilter);
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data } = await query;
    if (data) {
      // Filter out contacts without email or where company status filter didn't match
      let filtered = data.filter((c: any) => c.email);
      if (statusFilter) {
        filtered = filtered.filter((c: any) => c.company?.status === statusFilter);
      }
      setContacts(filtered);
    }
    setLoading(false);
  }, [search, personaFilter, warmthFilter, statusFilter]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const toggleSelect = (c: any) => {
    setSelected(prev => {
      const n = { ...prev };
      if (n[c.id]) delete n[c.id];
      else n[c.id] = c;
      return n;
    });
  };

  const selectAllVisible = () => {
    const n = { ...selected };
    contacts.forEach(c => { n[c.id] = c; });
    setSelected(n);
  };

  const filteredTemplates = trackFilter
    ? TEMPLATES.filter(t => t.track === trackFilter)
    : TEMPLATES;

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
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="page-title">Dispatch</h1>
        <p className="page-subtitle">Search → Select → Template → Gmail drafts</p>
      </div>

      {/* Step tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--space-5)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxWidth: 560 }}>
        <button onClick={() => setStep('search')}
          style={{ flex: 1, padding: '10px 16px', border: 'none', fontSize: 'var(--text-sm)', fontWeight: step === 'search' ? 700 : 500, background: step === 'search' ? 'var(--accent-soft)' : 'var(--bg-card)', color: step === 'search' ? 'var(--accent-text)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
          ① Search & Select
        </button>
        <button onClick={() => selectedCount > 0 && setStep('template')}
          style={{ flex: 1, padding: '10px 16px', border: 'none', borderLeft: '1px solid var(--border-default)', fontSize: 'var(--text-sm)', fontWeight: step === 'template' ? 700 : 500, background: step === 'template' ? 'var(--accent-soft)' : 'var(--bg-card)', color: step === 'template' ? 'var(--accent-text)' : 'var(--text-secondary)', cursor: selectedCount > 0 ? 'pointer' : 'not-allowed', opacity: selectedCount > 0 ? 1 : 0.4, fontFamily: 'inherit' }}>
          ② Template
        </button>
        <button onClick={() => selectedCount > 0 && tplId && setStep('preview')}
          style={{ flex: 1, padding: '10px 16px', border: 'none', borderLeft: '1px solid var(--border-default)', fontSize: 'var(--text-sm)', fontWeight: step === 'preview' ? 700 : 500, background: step === 'preview' ? 'var(--accent-soft)' : 'var(--bg-card)', color: step === 'preview' ? 'var(--accent-text)' : 'var(--text-secondary)', cursor: selectedCount > 0 && tplId ? 'pointer' : 'not-allowed', opacity: selectedCount > 0 && tplId ? 1 : 0.4, fontFamily: 'inherit' }}>
          ③ Preview & Draft
        </button>
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-sidebar)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        <span><strong style={{ color: 'var(--accent)' }}>{selectedCount}</strong> contacts selected</span>
        {tpl && <span>• Template: <strong>{tpl.name}</strong></span>}
        {selectedCount > 0 && (
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
            onClick={() => setSelected({})}>
            Clear all
          </button>
        )}
      </div>

      {/* ═══ STEP 1: SEARCH ═══ */}
      {step === 'search' && (
        <div>
          <div className="filters-row" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ flex: '1 1 300px', maxWidth: 400 }}>
              <input className="input" placeholder="Search by name or email…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input select" style={{ width: 180 }}
              value={personaFilter} onChange={e => setPersonaFilter(e.target.value)}>
              <option value="">All Personas</option>
              {['cmo_cro', 'field_marketing', 'demand_gen', 'events', 'channel_alliance', 'director_marketing', 'marketing_other', 'regional_sales'].map(p =>
                <option key={p} value={p}>{PERSONA_LABELS[p]}</option>
              )}
            </select>
            <select className="input select" style={{ width: 140 }}
              value={warmthFilter} onChange={e => setWarmthFilter(e.target.value)}>
              <option value="">All Warmth</option>
              {['hot', 'warm', 'cool', 'cold'].map(w =>
                <option key={w} value={w}>{WARMTH_LABELS[w]}</option>
              )}
            </select>
            <select className="input select" style={{ width: 160 }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Companies</option>
              <option value="client">Client</option>
              <option value="prospect">Prospect</option>
              <option value="high_value">High Value</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={selectAllVisible}>
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
              <button className="btn btn-primary" onClick={() => setStep('template')}>
                Next: Choose template →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 2: TEMPLATE ═══ */}
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
                  borderLeftWidth: 3,
                  borderLeftColor: TRACK_COLORS[t.track],
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
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>
                Fill in the variables for this template. Leave blank for any that aren't needed — they'll show as placeholder tags.
              </p>
              <div className="card" style={{ padding: 'var(--space-5)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>City</label>
                    <input className="input" value={vars['{CITY}']} onChange={e => setVars(p => ({ ...p, '{CITY}': e.target.value }))} placeholder="e.g. Chicago" />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Event date (display)</label>
                    <input className="input" value={vars['{DATE}']} onChange={e => setVars(p => ({ ...p, '{DATE}': e.target.value }))} placeholder="e.g. Tuesday, September 15, 2026" />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Short date</label>
                    <input className="input" value={vars['{DS}']} onChange={e => setVars(p => ({ ...p, '{DS}': e.target.value }))} placeholder="e.g. Sep 15" />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Conference</label>
                    <input className="input" value={vars['{CONF}']} onChange={e => setVars(p => ({ ...p, '{CONF}': e.target.value }))} placeholder="e.g. RSA Conference" />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Price</label>
                    <input className="input" value={vars['{PRICE}']} onChange={e => setVars(p => ({ ...p, '{PRICE}': e.target.value }))} placeholder="$15,000" />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Capacity</label>
                    <input className="input" value={vars['{CAP}']} onChange={e => setVars(p => ({ ...p, '{CAP}': e.target.value }))} placeholder="15" />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Solution area</label>
                    <input className="input" value={vars['{SOLUTION}']} onChange={e => setVars(p => ({ ...p, '{SOLUTION}': e.target.value }))} placeholder="e.g. cloud security" />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Target CISO profile</label>
                    <input className="input" value={vars['{TARGET}']} onChange={e => setVars(p => ({ ...p, '{TARGET}': e.target.value }))} placeholder="e.g. enterprise CISOs in finserv" />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Package size</label>
                    <input className="input" value={vars['{PKG}']} onChange={e => setVars(p => ({ ...p, '{PKG}': e.target.value }))} placeholder="20" />
                  </div>
                </div>

                <details style={{ marginTop: 'var(--space-4)' }}>
                  <summary style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}>More variables</summary>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                    <div>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Confirmed attendees</label>
                      <textarea className="input" rows={3} value={vars['{ATTENDEES}']} onChange={e => setVars(p => ({ ...p, '{ATTENDEES}': e.target.value }))} placeholder="- CISO, Company" style={{ resize: 'vertical' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Past stats</label>
                      <textarea className="input" rows={3} value={vars['{STATS}']} onChange={e => setVars(p => ({ ...p, '{STATS}': e.target.value }))} placeholder="23 CISOs from JPMorgan, Walmart…" style={{ resize: 'vertical' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Proof points</label>
                      <textarea className="input" rows={3} value={vars['{PROOF}']} onChange={e => setVars(p => ({ ...p, '{PROOF}': e.target.value }))} placeholder="20/20 briefings completed…" style={{ resize: 'vertical' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Competitor sponsors</label>
                      <input className="input" value={vars['{COMPETITORS}']} onChange={e => setVars(p => ({ ...p, '{COMPETITORS}': e.target.value }))} placeholder="CrowdStrike, Palo Alto, Zscaler" />
                    </div>
                    <div>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Cities remaining</label>
                      <textarea className="input" rows={3} value={vars['{CITIES}']} onChange={e => setVars(p => ({ ...p, '{CITIES}': e.target.value }))} placeholder="- Chicago, Jun 10" style={{ resize: 'vertical' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Deck link</label>
                      <input className="input" value={vars['{DECK}']} onChange={e => setVars(p => ({ ...p, '{DECK}': e.target.value }))} placeholder="https://..." />
                    </div>
                    <div>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Topic</label>
                      <input className="input" value={vars['{TOPIC}']} onChange={e => setVars(p => ({ ...p, '{TOPIC}': e.target.value }))} placeholder="e.g. AI governance" />
                    </div>
                  </div>
                </details>
              </div>

              <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-secondary" onClick={() => setStep('search')}>← Back to contacts</button>
                <button className="btn btn-primary" onClick={() => setStep('preview')}>Preview {selectedCount} emails →</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ STEP 3: PREVIEW & DRAFT ═══ */}
      {step === 'preview' && tpl && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>
              Preview — {selectedCount} email{selectedCount !== 1 ? 's' : ''}
            </h2>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-primary" onClick={createDrafts} disabled={drafting}
                style={{ background: 'var(--green)', borderColor: 'var(--green)' }}>
                {drafting ? 'Creating drafts…' : `✉ Create ${selectedCount} Gmail draft${selectedCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          {/* Draft results */}
          {draftResult && (
            <div className="card" style={{
              marginBottom: 'var(--space-5)', padding: 'var(--space-4)',
              background: draftResult.error ? 'var(--red-soft)' : 'var(--green-soft)',
              borderColor: draftResult.error ? 'var(--red)' : 'var(--green)',
            }}>
              {draftResult.error ? (
                <span style={{ color: 'var(--red)', fontWeight: 600 }}>Error: {draftResult.error}</span>
              ) : (
                <div>
                  <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 'var(--text-base)' }}>
                    ✓ {draftResult.successCount}/{draftResult.totalCount} drafts created in Gmail
                  </span>
                  {draftResult.results?.filter((r: any) => !r.success).map((r: any, i: number) => (
                    <div key={i} style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--red)' }}>
                      Failed: {r.to} — {r.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Email previews */}
          {Object.values(selected).map((contact: any) => {
            const merged = mergeTemplate(tpl, contact, vars);
            return (
              <div key={contact.id} className="card" style={{
                padding: 'var(--space-4)', marginBottom: 'var(--space-3)',
                borderLeftWidth: 3, borderLeftColor: TRACK_COLORS[tpl.track],
              }}>
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
                <div style={{
                  fontSize: 'var(--text-xs)', whiteSpace: 'pre-wrap', lineHeight: 1.65,
                  fontFamily: 'var(--font-mono)', background: 'var(--bg-sidebar)',
                  padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
                  maxHeight: 300, overflowY: 'auto',
                }}>
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

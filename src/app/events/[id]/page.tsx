// src/app/events/[id]/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
  NUDGE_TEMPLATES,
  NUDGE_BY_ID,
  renderNudge,
  type NudgeTemplate,
} from '@/lib/nudge-templates';

// ─────────────────────────────────────────────────────────────────────────
// If misha.sobolev@aphinia.com is NOT the first Google account signed into this
// browser, bump this index (u/0 → u/1, u/2 …) so drafts open in the right inbox.
const GMAIL_ACCOUNT_INDEX = 0;
// ─────────────────────────────────────────────────────────────────────────

const supabase = createClient();

interface DealRow {
  id: string;
  event_id: string;
  amount: number | null;
  status: string;
  sent_date: string | null;
  companies: { name: string } | null;
  contacts: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    title: string | null;
  } | null;
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
  conference_association: string | null;
}

const BUCKETS: { key: string; label: string; badge: string }[] = [
  { key: 'prop_sent',    label: 'Prop sent',    badge: 'badge-blue'   },
  { key: 'opportunity',  label: 'Opportunity',  badge: 'badge-yellow' },
  { key: 'prop_signed',  label: 'Sold',         badge: 'badge-green'  },
  { key: 'closed_lost',  label: 'Closed lost',  badge: 'badge-red'    },
  { key: 'no_inventory', label: 'No inventory', badge: 'badge-gray'   },
  { key: 'refunded',     label: 'Refunded',     badge: 'badge-purple' },
];
const BADGE_FOR: Record<string, string> = Object.fromEntries(BUCKETS.map(b => [b.key, b.badge]));

// Buckets where an opportunity nudge makes sense (open pipeline).
const NUDGEABLE = new Set(['prop_sent', 'opportunity']);

function daysSince(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000);
}

function contactName(c: DealRow['contacts']) {
  if (!c) return null;
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return n || null;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = String(params.id);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBucket, setActiveBucket] = useState('prop_sent');

  // Nudge modal state
  const [nudgeDeal, setNudgeDeal] = useState<DealRow | null>(null);
  const [tplId, setTplId] = useState('');
  const [tplFilter, setTplFilter] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [eventRes, dealsRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase
        .from('deals')
        .select('id, event_id, amount, status, sent_date, companies(name), contacts(id, first_name, last_name, email, title)')
        .eq('event_id', eventId),
    ]);
    setEvent((eventRes.data as unknown as EventRow) || null);
    setDeals((dealsRes.data as unknown as DealRow[]) || []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const counts: Record<string, number> = {};
  deals.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });

  const visibleBuckets = BUCKETS.filter(b => NUDGEABLE.has(b.key) || (counts[b.key] || 0) > 0);
  const activeDeals = deals.filter(d => d.status === activeBucket);

  // Keep the active bucket valid if it ends up empty after load.
  useEffect(() => {
    if (!loading && (counts[activeBucket] || 0) === 0 && !NUDGEABLE.has(activeBucket)) {
      setActiveBucket('prop_sent');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function openNudge(deal: DealRow) {
    setNudgeDeal(deal);
    setTplId('');
    setTplFilter('');
    setDraftResult(null);
    setDrafting(false);
  }
  function closeNudge() {
    setNudgeDeal(null);
    setDrafting(false);
    setDraftResult(null);
  }

  const filteredTemplates = tplFilter
    ? NUDGE_TEMPLATES.filter(t =>
        t.label.toLowerCase().includes(tplFilter.toLowerCase()) ||
        t.trigger.toLowerCase().includes(tplFilter.toLowerCase()))
    : NUDGE_TEMPLATES;

  const selectedTpl: NudgeTemplate | undefined = tplId ? NUDGE_BY_ID[tplId] : undefined;
  const contact = nudgeDeal?.contacts || null;
  const preview = selectedTpl && contact
    ? renderNudge(selectedTpl, { first_name: contact.first_name })
    : null;

  async function createDraft() {
    if (!selectedTpl || !contact?.email || !preview) return;
    setDrafting(true);
    setDraftResult(null);
    try {
      const res = await fetch('/api/draft-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drafts: [{ to: contact.email, subject: preview.subject, body: preview.body }],
        }),
      });
      const data = await res.json();
      if (data.error) {
        setDraftResult({ ok: false, msg: data.error });
      } else if ((data.successCount || 0) >= 1) {
        setDraftResult({ ok: true, msg: `Draft created for ${contact.email}` });
        window.open(`https://mail.google.com/mail/u/${GMAIL_ACCOUNT_INDEX}/#drafts`, '_blank');
      } else {
        const firstErr = data.results?.[0]?.error || 'No draft was created';
        setDraftResult({ ok: false, msg: firstErr });
      }
    } catch (err: unknown) {
      setDraftResult({ ok: false, msg: err instanceof Error ? err.message : 'Request failed' });
    }
    setDrafting(false);
  }

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>;
  }

  if (!event) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
        <div style={{ fontWeight: 600 }}>Event not found</div>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-4)' }} onClick={() => router.push('/events')}>
          ← Back to events
        </button>
      </div>
    );
  }

  const sold = counts['prop_signed'] || 0;
  const available = Math.max(0, (event.max_sponsors || 0) - sold);

  return (
    <div>
      {/* ─── Header ─── */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => router.push('/events')}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        ← Events
      </button>

      <div className="page-header" style={{ marginBottom: 'var(--space-5)' }}>
        <h1 className="page-title">{event.name}</h1>
        <p className="page-subtitle" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {event.event_date && (
            <span>{new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          )}
          {event.city && <span>· {event.city}</span>}
          {event.format && <span>· {event.format}</span>}
          {event.conference_association && <span>· {event.conference_association}</span>}
          <span>· {sold} sold / {available} available</span>
        </p>
      </div>

      {/* ─── Bucket pills ─── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {visibleBuckets.map(b => {
          const count = counts[b.key] || 0;
          const isActive = activeBucket === b.key;
          return (
            <button
              key={b.key}
              onClick={() => setActiveBucket(b.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)', fontWeight: 600,
                border: '1px solid var(--border-default)',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                outline: isActive ? '2px solid var(--accent)' : 'none',
                cursor: 'pointer',
              }}
            >
              <span className={`badge ${b.badge}`} style={{ fontSize: 'var(--text-xs)' }}>{count}</span>
              {b.label}
            </button>
          );
        })}
      </div>

      {/* ─── Deal rows for the active bucket ─── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Prop sent</th>
              <th style={{ width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {activeDeals.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-tertiary)' }}>
                  No deals in this stage.
                </td>
              </tr>
            ) : (
              activeDeals.map(d => {
                const sentAgo = daysSince(d.sent_date);
                const canNudge = NUDGEABLE.has(d.status);
                const email = d.contacts?.email || null;
                return (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{d.companies?.name || '—'}</td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>
                      {contactName(d.contacts) || '—'}
                      {email && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{email}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      ${(d.amount || 0).toLocaleString()}
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)', color: sentAgo != null && sentAgo > 14 ? 'var(--red)' : 'var(--text-secondary)' }}>
                      {sentAgo != null ? `${sentAgo}d ago` : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td>
                      {canNudge ? (
                        email ? (
                          <button className="btn btn-primary btn-sm" onClick={() => openNudge(d)}>Nudge →</button>
                        ) : (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>no email</span>
                        )
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ NUDGE MODAL ═══ */}
      {nudgeDeal && (
        <div className="modal-overlay" onClick={closeNudge}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 940, width: '92vw' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                Nudge — {contactName(nudgeDeal.contacts) || nudgeDeal.companies?.name}
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 'var(--space-2)' }}>
                  {nudgeDeal.contacts?.email}
                </span>
              </h2>
              <button className="btn-ghost" onClick={closeNudge} style={{ padding: 4, fontSize: 20 }}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--space-4)', minHeight: 380 }}>
              {/* Left: template list */}
              <div style={{ borderRight: '1px solid var(--border-default)', paddingRight: 'var(--space-4)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <input
                  className="input"
                  placeholder="Filter nudges…"
                  value={tplFilter}
                  onChange={e => setTplFilter(e.target.value)}
                  style={{ marginBottom: 'var(--space-3)' }}
                />
                <div style={{ overflowY: 'auto', maxHeight: 420, display: 'grid', gap: 'var(--space-2)' }}>
                  {filteredTemplates.map(t => {
                    const isSel = tplId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTplId(t.id)}
                        style={{
                          textAlign: 'left', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                          border: isSel ? '2px solid var(--accent)' : '1px solid var(--border-default)',
                          background: isSel ? 'var(--accent-soft)' : 'var(--bg-card)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{t.trigger}</div>
                      </button>
                    );
                  })}
                  {filteredTemplates.length === 0 && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', padding: 'var(--space-2)' }}>No nudges match.</div>
                  )}
                </div>
              </div>

              {/* Right: preview */}
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                {!selectedTpl ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                    Pick a nudge on the left to preview it.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      {selectedTpl.trigger} · {selectedTpl.why}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Subject</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-3)' }}>
                      {preview?.subject}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Body</div>
                    <div style={{
                      fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', lineHeight: 1.6,
                      fontFamily: 'var(--font-mono)', background: 'var(--bg-sidebar)',
                      padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
                      flex: 1, overflowY: 'auto', marginTop: 4,
                    }}>
                      {preview?.body}
                    </div>

                    {draftResult && (
                      <div style={{
                        marginTop: 'var(--space-3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)', fontWeight: 600,
                        background: draftResult.ok ? '#F0FDF4' : '#FEF2F2',
                        color: draftResult.ok ? 'var(--green)' : 'var(--red)',
                        border: `1px solid ${draftResult.ok ? 'var(--green)' : 'var(--red)'}`,
                      }}>
                        {draftResult.ok ? `✓ ${draftResult.msg} — opening Gmail drafts…` : `Error: ${draftResult.msg}`}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={closeNudge}>
                {draftResult?.ok ? 'Done' : 'Cancel'}
              </button>
              <button
                className="btn btn-primary"
                onClick={createDraft}
                disabled={!selectedTpl || !contact?.email || drafting || !!draftResult?.ok}
                style={{ background: 'var(--green)', borderColor: 'var(--green)' }}
              >
                {drafting ? 'Creating draft…' : draftResult?.ok ? '✓ Created' : '✉ Create Gmail draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

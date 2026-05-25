// app/companies/[id]/page.tsx
// Screen 3: Company Detail — single company view with all intel
// Header with status badge + inline edit for status/tag/comment
// Tabs: Contacts | Deals | Conferences | Interactions | Outreach

'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  STATUS_LABELS, STATUS_COLORS,
  WARMTH_LABELS, WARMTH_COLORS,
  PERSONA_LABELS,
  DEAL_STAGE_LABELS,
  SOURCE_LABELS,
} from '@/lib/supabase-types';

const supabase = createClient();

type TabId = 'contacts' | 'deals' | 'conferences' | 'interactions' | 'outreach';

interface CompanyData {
  id: string;
  name: string;
  url: string | null;
  linkedin: string | null;
  focus: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  region: string | null;
  employees: number | null;
  description: string | null;
  status: string;
  conference_count: number;
  tag: string | null;
  comment: string | null;
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('contacts');

  // Inline edit state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Tab data
  const [contacts, setContacts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [conferences, setConferences] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [outreach, setOutreach] = useState<any[]>([]);

  useEffect(() => {
    loadCompany();
  }, [id]);

  useEffect(() => {
    if (company) loadTabData(activeTab);
  }, [activeTab, company]);

  async function loadCompany() {
    setLoading(true);
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();
    if (data) setCompany(data as CompanyData);
    setLoading(false);
  }

  async function loadTabData(tab: TabId) {
    switch (tab) {
      case 'contacts': {
        const { data } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, title, persona, warmth, seniority, email_status, city, state, phone')
          .eq('company_id', id)
          .order('warmth', { ascending: true })
          .order('last_name', { ascending: true });
        setContacts(data ?? []);
        break;
      }
      case 'deals': {
        const { data } = await supabase
          .from('deals')
          .select(`
            id, status, amount, event_id, contact_id, follow_up, follow_up_date,
            created_at, sent_date, signed_date, invoice_date, paid_date,
            events(name, event_date),
            contacts(first_name, last_name)
          `)
          .eq('company_id', id)
          .order('created_at', { ascending: false });
        setDeals(data ?? []);
        break;
      }
      case 'conferences': {
        const { data } = await supabase
          .from('company_conferences')
          .select('id, conference_id, conferences(name, slug, year)')
          .eq('company_id', id)
          .order('conferences(name)', { ascending: true });
        setConferences(data ?? []);
        break;
      }
      case 'interactions': {
        const { data } = await supabase
          .from('interactions')
          .select('id, interaction_date, source, notes, follow_up, follow_up_date, contact_id, contacts(first_name, last_name)')
          .eq('company_id', id)
          .order('interaction_date', { ascending: false });
        setInteractions(data ?? []);
        break;
      }
      case 'outreach': {
        // Get all contacts at this company, then their campaign targets
        const { data: companyContacts } = await supabase
          .from('contacts')
          .select('id')
          .eq('company_id', id);
        const contactIds = companyContacts?.map(c => c.id) ?? [];
        if (contactIds.length > 0) {
          const { data } = await supabase
            .from('campaign_targets')
            .select(`
              id, date_sent, date_replied,
              contacts(first_name, last_name, email),
              campaigns(name, wave, event_id, events(name))
            `)
            .in('contact_id', contactIds)
            .order('date_sent', { ascending: false });
          setOutreach(data ?? []);
        } else {
          setOutreach([]);
        }
        break;
      }
    }
  }

  // ── Inline editing ──
  async function saveField(field: string, value: string) {
    if (!company) return;
    const { error } = await supabase
      .from('companies')
      .update({ [field]: value || null, updated_at: new Date().toISOString() })
      .eq('id', company.id);
    if (!error) {
      setCompany(prev => prev ? { ...prev, [field]: value || null } : null);
    }
    setEditingField(null);
  }

  async function saveStatus(newStatus: string) {
    if (!company) return;
    const { error } = await supabase
      .from('companies')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', company.id);
    if (!error) {
      setCompany(prev => prev ? { ...prev, status: newStatus } : null);
    }
  }

  if (loading) {
    return <div style={{ padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>Loading…</div>;
  }

  if (!company) {
    return <div style={{ padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>Company not found.</div>;
  }

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'contacts', label: 'Contacts', count: contacts.length },
    { id: 'deals', label: 'Deals', count: deals.length },
    { id: 'conferences', label: 'Conferences', count: conferences.length },
    { id: 'interactions', label: 'Interactions', count: interactions.length },
    { id: 'outreach', label: 'Outreach', count: outreach.length },
  ];

  return (
    <div style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 1200 }}>
      {/* Back */}
      <Link
        href="/companies"
        style={{
          fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)',
          textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-block',
        }}
      >
        ← All Companies
      </Link>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
              {company.name}
            </h1>
            <select
              className="input select"
              value={company.status}
              onChange={e => saveStatus(e.target.value)}
              style={{
                fontSize: 'var(--text-xs)',
                padding: '4px 8px',
                fontWeight: 600,
                minWidth: 'auto',
                width: 'auto',
              }}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)',
            fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
          }}>
            {company.url && (
              <a href={company.url.startsWith('http') ? company.url : `https://${company.url}`}
                 target="_blank" rel="noopener noreferrer"
                 style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                🌐 {company.url}
              </a>
            )}
            {company.linkedin && (
              <a href={company.linkedin.startsWith('http') ? company.linkedin : `https://${company.linkedin}`}
                 target="_blank" rel="noopener noreferrer"
                 style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                💼 LinkedIn
              </a>
            )}
            {company.employees && <span>👥 {company.employees.toLocaleString()} employees</span>}
            {(company.city || company.state || company.country) && (
              <span>📍 {[company.city, company.state, company.country].filter(Boolean).join(', ')}</span>
            )}
            {company.region && <span>🌍 {company.region}</span>}
            {company.focus && <span>🎯 {company.focus}</span>}
            <span>📊 {company.conference_count} conferences</span>
          </div>
        </div>
      </div>

      {/* ── Editable fields: Tag & Comment ── */}
      <div className="card" style={{ marginBottom: 'var(--space-5)', display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        {/* Tag */}
        <div style={{ flex: '0 0 280px' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
            TAG
          </label>
          {editingField === 'tag' ? (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                className="input"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveField('tag', editValue); if (e.key === 'Escape') setEditingField(null); }}
                autoFocus
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary btn-sm" onClick={() => saveField('tag', editValue)}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingField(null)}>✕</button>
            </div>
          ) : (
            <div
              onClick={() => { setEditingField('tag'); setEditValue(company.tag ?? ''); }}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--text-base)',
                color: company.tag ? 'var(--text-primary)' : 'var(--text-tertiary)',
                border: '1px dashed var(--border-default)',
                minHeight: 36,
              }}
            >
              {company.tag || 'Click to add tag…'}
            </div>
          )}
        </div>

        {/* Comment */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
            NOTES / HUMINT
          </label>
          {editingField === 'comment' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <textarea
                className="input"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                rows={3}
                autoFocus
                style={{ resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="btn btn-primary btn-sm" onClick={() => saveField('comment', editValue)}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingField(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => { setEditingField('comment'); setEditValue(company.comment ?? ''); }}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--text-base)',
                color: company.comment ? 'var(--text-primary)' : 'var(--text-tertiary)',
                border: '1px dashed var(--border-default)',
                minHeight: 36,
                whiteSpace: 'pre-wrap',
              }}
            >
              {company.comment || 'Click to add notes…'}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '2px solid var(--border-default)',
        marginBottom: 'var(--space-5)',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              fontSize: 'var(--text-sm)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                marginLeft: 6,
                fontSize: 'var(--text-xs)',
                background: activeTab === tab.id ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                padding: '2px 7px',
                borderRadius: 'var(--radius-full)',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'contacts' && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Title</th>
              <th>Persona</th>
              <th>Warmth</th>
              <th>Email</th>
              <th>Email Status</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.first_name} {c.last_name}</div>
                  {c.seniority && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{c.seniority}</div>}
                </td>
                <td style={{ fontSize: 'var(--text-sm)' }}>{c.title ?? '—'}</td>
                <td>
                  {c.persona ? <span className="badge badge-gray">{PERSONA_LABELS[c.persona as ContactPersona] ?? c.persona}</span> : '—'}
                </td>
                <td>
                  <span className={`badge badge-${WARMTH_COLORS[c.warmth as ContactWarmth] ?? 'gray'}`}>
                    {WARMTH_LABELS[c.warmth as ContactWarmth] ?? c.warmth}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{c.email ?? '—'}</td>
                <td>
                  <span className={`badge badge-${c.email_status === 'verified' ? 'green' : c.email_status === 'bounced' ? 'red' : 'gray'}`}>
                    {c.email_status ?? 'unknown'}
                  </span>
                </td>
                <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>No contacts</td></tr>
            )}
          </tbody>
        </table>
      )}

      {activeTab === 'deals' && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Contact</th>
              <th>Stage</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Follow-up</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d: any) => {
              const isOverdue = d.follow_up_date && new Date(d.follow_up_date) <= new Date() &&
                !['invoice_paid', 'closed_lost'].includes(d.status);
              return (
                <tr key={d.id} style={isOverdue ? { borderLeft: '3px solid var(--color-red)' } : undefined}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.events?.name ?? '—'}</div>
                    {d.events?.event_date && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {new Date(d.events.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 'var(--text-sm)' }}>
                    {d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : '—'}
                  </td>
                  <td>
                    <span className={`badge badge-${
                      d.status === 'invoice_paid' ? 'green' :
                      d.status === 'closed_lost' ? 'red' :
                      d.status === 'prop_signed' ? 'blue' :
                      'yellow'
                    }`}>
                      {DEAL_STAGE_LABELS[d.status as DealStatus] ?? d.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {d.amount ? `$${Number(d.amount).toLocaleString()}` : '—'}
                  </td>
                  <td>
                    {d.follow_up && (
                      <div style={{ fontSize: 'var(--text-sm)' }}>{d.follow_up}</div>
                    )}
                    {d.follow_up_date && (
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: isOverdue ? 'var(--color-red)' : 'var(--text-tertiary)',
                        fontWeight: isOverdue ? 600 : 400,
                      }}>
                        {isOverdue ? '⚠️ ' : ''}
                        {new Date(d.follow_up_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    {new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              );
            })}
            {deals.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>No deals</td></tr>
            )}
          </tbody>
        </table>
      )}

      {activeTab === 'conferences' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {conferences.map((cc: any) => (
            <span key={cc.id} className="badge badge-blue" style={{ fontSize: 'var(--text-sm)', padding: '6px 14px' }}>
              {cc.conferences?.name ?? cc.conference_id}
              {cc.conferences?.year ? ` (${cc.conferences.year})` : ''}
            </span>
          ))}
          {conferences.length === 0 && (
            <p style={{ color: 'var(--text-tertiary)' }}>No conference footprint recorded.</p>
          )}
        </div>
      )}

      {activeTab === 'interactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {interactions.map((i: any) => {
            const isOverdue = i.follow_up_date && new Date(i.follow_up_date) <= new Date();
            return (
              <div
                key={i.id}
                className="card"
                style={isOverdue ? { borderLeft: '3px solid var(--color-red)' } : undefined}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <span className="badge badge-gray">
                      {SOURCE_LABELS[i.source as InteractionSource] ?? i.source}
                    </span>
                    {i.contacts && (
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        with {i.contacts.first_name} {i.contacts.last_name}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    {i.interaction_date ? new Date(i.interaction_date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    }) : '—'}
                  </span>
                </div>
                {i.notes && (
                  <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {i.notes}
                  </p>
                )}
                {(i.follow_up || i.follow_up_date) && (
                  <div style={{
                    marginTop: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: isOverdue ? 'rgba(239,68,68,0.08)' : 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    color: isOverdue ? 'var(--color-red)' : 'var(--text-secondary)',
                  }}>
                    {isOverdue && '⚠️ '}
                    <strong>Follow-up:</strong> {i.follow_up}
                    {i.follow_up_date && (
                      <span style={{ marginLeft: 'var(--space-2)' }}>
                        by {new Date(i.follow_up_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {interactions.length === 0 && (
            <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-6)' }}>
              No interactions recorded. Use the Quick Note button to add one.
            </p>
          )}
        </div>
      )}

      {activeTab === 'outreach' && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Event</th>
              <th>Contact</th>
              <th>Sent</th>
              <th>Replied</th>
            </tr>
          </thead>
          <tbody>
            {outreach.map((o: any) => (
              <tr key={o.id}>
                <td style={{ fontWeight: 600 }}>{o.campaigns?.name ?? '—'}</td>
                <td style={{ fontSize: 'var(--text-sm)' }}>{o.campaigns?.events?.name ?? '—'}</td>
                <td style={{ fontSize: 'var(--text-sm)' }}>
                  {o.contacts ? `${o.contacts.first_name} ${o.contacts.last_name}` : '—'}
                  {o.contacts?.email && (
                    <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                      {o.contacts.email}
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 'var(--text-sm)' }}>
                  {o.date_sent ? new Date(o.date_sent + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </td>
                <td>
                  {o.date_replied ? (
                    <span className="badge badge-green">
                      {new Date(o.date_replied + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  ) : (
                    <span className="badge badge-gray">No reply</span>
                  )}
                </td>
              </tr>
            ))}
            {outreach.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>No outreach history</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

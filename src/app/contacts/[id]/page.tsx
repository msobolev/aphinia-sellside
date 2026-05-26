// src/app/contacts/[id]/page.tsx
// Contact detail page with edit mode

'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  WARMTH_LABELS, WARMTH_COLORS,
  PERSONA_LABELS,
  DEAL_STAGE_LABELS,
  SOURCE_LABELS,
} from '@/lib/supabase-types';
import type { ContactPersona, ContactWarmth } from '@/lib/supabase-types';

const supabase = createClient();

const PERSONA_OPTIONS: ContactPersona[] = ['cmo_cro', 'field_marketing', 'demand_gen', 'events', 'channel_alliance', 'director_marketing', 'marketing_other', 'regional_sales'];
const WARMTH_OPTIONS: ContactWarmth[] = ['hot', 'warm', 'cool', 'cold', 'dni'];

interface ContactData {
  id: string;
  company_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  title: string | null;
  persona: string | null;
  warmth: string;
  seniority: string | null;
  departments: string | null;
  sub_departments: string | null;
  linkedin: string | null;
  phone: string | null;
  mobile: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  email_status: string;
  crm_context: string | null;
  crm_source: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
  company?: { id: string; name: string; status: string } | null;
}

type TabId = 'details' | 'deals' | 'interactions' | 'outreach' | 'duplicates';

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [contact, setContact] = useState<ContactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<ContactData>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('details');

  // Tab data
  const [deals, setDeals] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [outreach, setOutreach] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [dupeLoading, setDupeLoading] = useState(false);

  useEffect(() => { loadContact(); }, [id]);
  useEffect(() => { if (contact) loadTabData(activeTab); }, [activeTab, contact]);

  async function loadContact() {
    setLoading(true);
    const { data } = await supabase
      .from('contacts')
      .select('*, company:companies(id, name, status)')
      .eq('id', id)
      .single();
    if (data) {
      setContact(data as ContactData);
      setForm(data as ContactData);
    }
    setLoading(false);
  }

  async function loadTabData(tab: TabId) {
    switch (tab) {
      case 'deals': {
        const { data } = await supabase
          .from('deals')
          .select('id, status, amount, sent_date, follow_up, follow_up_date, notes, events(name, event_date)')
          .eq('contact_id', id)
          .order('created_at', { ascending: false });
        setDeals(data ?? []);
        break;
      }
      case 'interactions': {
        const { data } = await supabase
          .from('interactions')
          .select('id, interaction_date, source, notes, follow_up, follow_up_date')
          .eq('contact_id', id)
          .order('interaction_date', { ascending: false });
        setInteractions(data ?? []);
        break;
      }
      case 'outreach': {
        const { data } = await supabase
          .from('campaign_targets')
          .select('id, date_sent, date_replied, campaigns(name, wave)')
          .eq('contact_id', id)
          .order('date_sent', { ascending: false });
        setOutreach(data ?? []);
        break;
      }
      case 'duplicates': {
        if (!contact) break;
        setDupeLoading(true);
        // Find potential dupes: same company + similar name, or same email domain
        const dupeResults: any[] = [];

        // Same company, different contact
        if (contact.company_id) {
          const { data: sameCompany } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, email, title, warmth, email_status, company:companies(name)')
            .eq('company_id', contact.company_id)
            .neq('id', id);
          if (sameCompany) dupeResults.push(...sameCompany.map((c: any) => ({ ...c, reason: 'Same company' })));
        }

        // Same email domain (different company)
        if (contact.email) {
          const domain = contact.email.split('@')[1];
          if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
            const { data: sameDomain } = await supabase
              .from('contacts')
              .select('id, first_name, last_name, email, title, warmth, email_status, company:companies(name)')
              .ilike('email', `%@${domain}`)
              .neq('id', id)
              .limit(20);
            if (sameDomain) {
              const existingIds = new Set(dupeResults.map(d => d.id));
              sameDomain.forEach((c: any) => {
                if (!existingIds.has(c.id)) dupeResults.push({ ...c, reason: 'Same email domain' });
              });
            }
          }
        }

        // Same first+last name (across companies)
        if (contact.first_name && contact.last_name) {
          const { data: sameName } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, email, title, warmth, email_status, company:companies(name)')
            .ilike('first_name', contact.first_name)
            .ilike('last_name', contact.last_name)
            .neq('id', id)
            .limit(10);
          if (sameName) {
            const existingIds = new Set(dupeResults.map(d => d.id));
            sameName.forEach((c: any) => {
              if (!existingIds.has(c.id)) dupeResults.push({ ...c, reason: 'Same name' });
            });
          }
        }

        setDuplicates(dupeResults);
        setDupeLoading(false);
        break;
      }
    }
  }

  async function handleSave() {
    if (!contact) return;
    setSaving(true);

    const payload: any = {
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      title: form.title || null,
      persona: form.persona || null,
      warmth: form.warmth || 'cold',
      seniority: form.seniority || null,
      departments: form.departments || null,
      sub_departments: form.sub_departments || null,
      linkedin: form.linkedin || null,
      phone: form.phone || null,
      mobile: form.mobile || null,
      city: form.city || null,
      state: form.state || null,
      country: form.country || null,
      email_status: form.email_status || 'unknown',
      crm_context: form.crm_context || null,
      crm_source: form.crm_source || null,
      industry: form.industry || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('contacts').update(payload).eq('id', contact.id);
    if (!error) {
      setContact(prev => prev ? { ...prev, ...payload } : null);
      setEditing(false);
      showToast('Contact saved');
    } else {
      showToast('Error saving contact');
    }
    setSaving(false);
  }

  async function handleMerge(dupeId: string) {
    if (!contact) return;
    if (!confirm('Merge this contact into the current record? All deals, interactions, and outreach from the duplicate will be moved here, and the duplicate will be deleted.')) return;

    // Move all foreign key references from dupe to primary
    await supabase.from('deals').update({ contact_id: contact.id }).eq('contact_id', dupeId);
    await supabase.from('interactions').update({ contact_id: contact.id }).eq('contact_id', dupeId);
    await supabase.from('campaign_targets').update({ contact_id: contact.id }).eq('contact_id', dupeId);

    // Delete the duplicate
    await supabase.from('contacts').delete().eq('id', dupeId);

    showToast('Contact merged');
    setDuplicates(prev => prev.filter(d => d.id !== dupeId));
    // Reload tab data
    loadTabData('deals');
    loadTabData('interactions');
    loadTabData('outreach');
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function updateField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  if (loading) return <div style={{ padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>Loading…</div>;
  if (!contact) return <div style={{ padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>Contact not found.</div>;

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'details', label: 'Details' },
    { id: 'deals', label: 'Deals', count: deals.length },
    { id: 'interactions', label: 'Interactions', count: interactions.length },
    { id: 'outreach', label: 'Outreach', count: outreach.length },
    { id: 'duplicates', label: 'Duplicates', count: duplicates.length },
  ];

  const wColor = WARMTH_COLORS[contact.warmth as ContactWarmth] || '#6b7280';

  return (
    <div style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 1200 }}>
      {/* Back */}
      <Link href="/contacts" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-block' }}>
        ← All Contacts
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <h1 style={{ fontSize: 28, fontWeight: 700 }}>
              {contact.first_name} {contact.last_name}
            </h1>
            <span className="badge" style={{ background: `${wColor}14`, color: wColor }}>
              {WARMTH_LABELS[contact.warmth] || contact.warmth}
            </span>
            {contact.email_status === 'verified' && <span className="badge badge-green">Verified</span>}
            {contact.email_status === 'bounced' && <span className="badge badge-red">Bounced</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {contact.title && <span>🏷️ {contact.title}</span>}
            {contact.company && (
              <Link href={`/companies/${contact.company.id}`} style={{ textDecoration: 'none' }}>
                🏢 {contact.company.name}
              </Link>
            )}
            {contact.email && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>✉️ {contact.email}</span>}
            {contact.persona && <span className="badge badge-blue" style={{ fontSize: 'var(--text-xs)' }}>{PERSONA_LABELS[contact.persona] || contact.persona}</span>}
            {(contact.city || contact.state) && <span>📍 {[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {editing ? (
            <>
              <button className="btn btn-secondary" onClick={() => { setEditing(false); setForm(contact); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit Contact</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-default)', marginBottom: 'var(--space-5)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '12px 20px', fontSize: 'var(--text-sm)',
            fontWeight: activeTab === tab.id ? 700 : 500,
            color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
            background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -2, cursor: 'pointer',
          }}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{ marginLeft: 6, fontSize: 'var(--text-xs)', background: activeTab === tab.id ? 'var(--accent-soft)' : 'var(--gray-soft)', padding: '2px 7px', borderRadius: 999 }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ DETAILS TAB ═══ */}
      {activeTab === 'details' && (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
            <FieldRow label="First name" value={form.first_name} field="first_name" editing={editing} onChange={updateField} />
            <FieldRow label="Last name" value={form.last_name} field="last_name" editing={editing} onChange={updateField} />
            <FieldRow label="Email" value={form.email} field="email" editing={editing} onChange={updateField} type="email" />
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>EMAIL STATUS</label>
              {editing ? (
                <select className="input select" value={form.email_status || 'unknown'} onChange={e => updateField('email_status', e.target.value)}>
                  <option value="verified">Verified</option>
                  <option value="bounced">Bounced</option>
                  <option value="unknown">Unknown</option>
                </select>
              ) : (
                <div style={{ padding: '6px 0', fontSize: 'var(--text-base)' }}>
                  <span className={`badge badge-${contact.email_status === 'verified' ? 'green' : contact.email_status === 'bounced' ? 'red' : 'gray'}`}>
                    {contact.email_status || 'unknown'}
                  </span>
                </div>
              )}
            </div>
            <FieldRow label="Title" value={form.title} field="title" editing={editing} onChange={updateField} />
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>PERSONA</label>
              {editing ? (
                <select className="input select" value={form.persona || ''} onChange={e => updateField('persona', e.target.value)}>
                  <option value="">— None —</option>
                  {PERSONA_OPTIONS.map(p => <option key={p} value={p}>{PERSONA_LABELS[p]}</option>)}
                </select>
              ) : (
                <div style={{ padding: '6px 0', fontSize: 'var(--text-base)' }}>
                  {contact.persona ? <span className="badge badge-blue">{PERSONA_LABELS[contact.persona] || contact.persona}</span> : '—'}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>WARMTH</label>
              {editing ? (
                <select className="input select" value={form.warmth || 'cold'} onChange={e => updateField('warmth', e.target.value)}>
                  {WARMTH_OPTIONS.map(w => <option key={w} value={w}>{WARMTH_LABELS[w]}</option>)}
                </select>
              ) : (
                <div style={{ padding: '6px 0', fontSize: 'var(--text-base)' }}>
                  <span className="badge" style={{ background: `${wColor}14`, color: wColor }}>{WARMTH_LABELS[contact.warmth] || contact.warmth}</span>
                </div>
              )}
            </div>
            <FieldRow label="Seniority" value={form.seniority} field="seniority" editing={editing} onChange={updateField} />
            <FieldRow label="Phone" value={form.phone} field="phone" editing={editing} onChange={updateField} />
            <FieldRow label="Mobile" value={form.mobile} field="mobile" editing={editing} onChange={updateField} />
            <FieldRow label="LinkedIn" value={form.linkedin} field="linkedin" editing={editing} onChange={updateField} />
            <FieldRow label="City" value={form.city} field="city" editing={editing} onChange={updateField} />
            <FieldRow label="State" value={form.state} field="state" editing={editing} onChange={updateField} />
            <FieldRow label="Country" value={form.country} field="country" editing={editing} onChange={updateField} />
            <FieldRow label="Industry" value={form.industry} field="industry" editing={editing} onChange={updateField} />
            <FieldRow label="Departments" value={form.departments} field="departments" editing={editing} onChange={updateField} />
            <FieldRow label="CRM Source" value={form.crm_source} field="crm_source" editing={editing} onChange={updateField} />
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>CRM CONTEXT</label>
              {editing ? (
                <textarea className="input" rows={4} value={form.crm_context || ''} onChange={e => updateField('crm_context', e.target.value)} style={{ resize: 'vertical' }} />
              ) : (
                <div style={{ padding: '6px 0', fontSize: 'var(--text-base)', whiteSpace: 'pre-wrap', color: contact.crm_context ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                  {contact.crm_context || '—'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ DEALS TAB ═══ */}
      {activeTab === 'deals' && (
        <table className="data-table">
          <thead>
            <tr><th>Event</th><th>Stage</th><th style={{ textAlign: 'right' }}>Amount</th><th>Follow-up</th><th>Sent</th></tr>
          </thead>
          <tbody>
            {deals.map((d: any) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.events?.name ?? '—'}</td>
                <td><span className={`badge badge-${d.status === 'invoice_paid' ? 'green' : d.status === 'closed_lost' ? 'red' : d.status === 'prop_signed' ? 'green' : 'yellow'}`}>{DEAL_STAGE_LABELS[d.status] ?? d.status}</span></td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{d.amount ? `$${Number(d.amount).toLocaleString()}` : '—'}</td>
                <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{d.follow_up || '—'}</td>
                <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{d.sent_date ? new Date(d.sent_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
              </tr>
            ))}
            {deals.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>No deals</td></tr>}
          </tbody>
        </table>
      )}

      {/* ═══ INTERACTIONS TAB ═══ */}
      {activeTab === 'interactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {interactions.map((i: any) => (
            <div key={i.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span className="badge badge-gray">{SOURCE_LABELS[i.source] ?? i.source}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  {i.interaction_date ? new Date(i.interaction_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </span>
              </div>
              {i.notes && <p style={{ fontSize: 'var(--text-base)', whiteSpace: 'pre-wrap', margin: 0 }}>{i.notes}</p>}
              {i.follow_up && (
                <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--gray-soft)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  <strong>Follow-up:</strong> {i.follow_up}
                  {i.follow_up_date && <span style={{ marginLeft: 'var(--space-2)' }}>by {new Date(i.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                </div>
              )}
            </div>
          ))}
          {interactions.length === 0 && <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-6)' }}>No interactions recorded.</p>}
        </div>
      )}

      {/* ═══ OUTREACH TAB ═══ */}
      {activeTab === 'outreach' && (
        <table className="data-table">
          <thead>
            <tr><th>Campaign</th><th>Wave</th><th>Sent</th><th>Replied</th></tr>
          </thead>
          <tbody>
            {outreach.map((o: any) => (
              <tr key={o.id}>
                <td style={{ fontWeight: 600 }}>{o.campaigns?.name ?? '—'}</td>
                <td>{o.campaigns?.wave ? `Wave ${o.campaigns.wave}` : '—'}</td>
                <td style={{ fontSize: 'var(--text-sm)' }}>{o.date_sent ? new Date(o.date_sent + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                <td>{o.date_replied ? <span className="badge badge-green">{new Date(o.date_replied + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span> : <span className="badge badge-gray">No reply</span>}</td>
              </tr>
            ))}
            {outreach.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>No outreach history</td></tr>}
          </tbody>
        </table>
      )}

      {/* ═══ DUPLICATES TAB ═══ */}
      {activeTab === 'duplicates' && (
        <div>
          {dupeLoading ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>Scanning for duplicates…</div>
          ) : duplicates.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>No potential duplicates found.</div>
          ) : (
            <div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                {duplicates.length} potential duplicate{duplicates.length !== 1 ? 's' : ''} found. Merging moves all deals, interactions, and outreach to this contact and deletes the duplicate.
              </p>
              {duplicates.map((d: any) => (
                <div key={d.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', padding: 'var(--space-4)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{d.first_name} {d.last_name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                      {d.company?.name || '—'} · {d.title || '—'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {d.email || 'No email'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span className="badge badge-yellow" style={{ fontSize: 'var(--text-xs)' }}>{d.reason}</span>
                    <Link href={`/contacts/${d.id}`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>View</Link>
                    <button className="btn btn-danger btn-sm" onClick={() => handleMerge(d.id)}>Merge into this</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--text-primary)', color: 'var(--text-inverse)', padding: '12px 24px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 600, boxShadow: 'var(--shadow-lg)', zIndex: 1000 }}>{toast}</div>
      )}
    </div>
  );
}

// ── Reusable field row ──
function FieldRow({ label, value, field, editing, onChange, type }: { label: string; value: string | null | undefined; field: string; editing: boolean; onChange: (f: string, v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</label>
      {editing ? (
        <input className="input" type={type || 'text'} value={value || ''} onChange={e => onChange(field, e.target.value)} />
      ) : (
        <div style={{ padding: '6px 0', fontSize: 'var(--text-base)', color: value ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
          {value || '—'}
        </div>
      )}
    </div>
  );
}

'use client';

// ============================================================
// Aphinia sellside — Conference sponsorship workbench
// src/app/conferences/page.tsx   ->  /conferences
//
// Features:
//  - Browse by conference / by company; add & remove sponsor links
//  - "Add conference" (name + year)
//  - CSV upload: conf name, sponsor company name, sponsor company url, sponsorship level
//      * matches each row to your CRM `companies` by URL, then exact name, then fuzzy (confirm-first)
//      * preview before any write; unmatched rows now CREATE a company (no more null company_id)
//  - Each displayed sponsor shows whether it's linked to a CRM company (+ status); fuzzy match on demand
//
// Requires columns on company_conferences: sponsorship_level (text), company_id (text)
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

const supabase = createClient();

type Conference = { id: string; name: string; year: number | null; slug: string };
type Link = {
  id: number;
  company_name: string;
  company_url: string | null;
  conference_id: string;
  sponsorship_level: string | null;
  company_id: string | null;
};
type Company = { id: string; name: string; url: string | null; status: string | null };
type Suggestion = { company: Company; score: number };

// ---------- helpers ----------
function normalizeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  let s = String(u).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim();
  return s || null;
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function normName(s: string): string { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function dice(a: string, b: string): number {
  a = normName(a); b = normName(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const big = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = big(a), B = big(b);
  let inter = 0, total = 0;
  for (const [g, c] of A) { total += c; const d = B.get(g); if (d) inter += Math.min(c, d); }
  for (const [, c] of B) total += c;
  return total ? (2 * inter) / total : 0;
}
function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c === '\r') { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = []; const SIZE = 1000;
  for (let from = 0; ; from += SIZE) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < SIZE) break;
  }
  return out;
}

type UploadRow = {
  confName: string;
  companyName: string;
  companyUrl: string | null;
  level: string;
  conf?: Conference;
  newConf: boolean;
  matchType: 'url' | 'name' | 'fuzzy' | 'none';
  company?: Company;
  suggestions: Suggestion[];
};

export default function ConferencesPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'conference' | 'company'>('conference');
  const [selectedConf, setSelectedConf] = useState<string | null>(null);
  const [confFilter, setConfFilter] = useState('');
  const [addQuery, setAddQuery] = useState('');
  const [matchRowId, setMatchRowId] = useState<number | null>(null);

  const [companyQuery, setCompanyQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const [showAddConf, setShowAddConf] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  async function loadAll() {
    try {
      setLoading(true);
      const [confs, lks, cos] = await Promise.all([
        supabase.from('conferences').select('id, name, year, slug').order('name'),
        fetchAll<Link>('company_conferences', 'id, company_name, company_url, conference_id, sponsorship_level, company_id'),
        fetchAll<Company>('companies', 'id, name, url, status'),
      ]);
      if (confs.error) throw confs.error;
      setConferences((confs.data ?? []) as Conference[]);
      setLinks(lks);
      setCompanies(cos);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadAll(); }, []);

  const countByConf = useMemo(() => { const m = new Map<string, number>(); for (const l of links) m.set(l.conference_id, (m.get(l.conference_id) ?? 0) + 1); return m; }, [links]);
  const confById = useMemo(() => { const m = new Map<string, Conference>(); for (const c of conferences) m.set(c.id, c); return m; }, [conferences]);
  const companyById = useMemo(() => { const m = new Map<string, Company>(); for (const c of companies) m.set(String(c.id), c); return m; }, [companies]);
  const companyByUrl = useMemo(() => { const m = new Map<string, Company>(); for (const c of companies) { const u = normalizeUrl(c.url); if (u && !m.has(u)) m.set(u, c); } return m; }, [companies]);
  const companyByName = useMemo(() => { const m = new Map<string, Company>(); for (const c of companies) { const n = c.name.toLowerCase().trim(); if (!m.has(n)) m.set(n, c); } return m; }, [companies]);

  function fuzzy(name: string, k = 5, threshold = 0.5): Suggestion[] {
    const res: Suggestion[] = [];
    for (const c of companies) { const s = dice(name, c.name); if (s >= threshold) res.push({ company: c, score: s }); }
    return res.sort((a, b) => b.score - a.score).slice(0, k);
  }

  async function addConference(name: string, year: number | null) {
    const trimmed = name.trim();
    // Reuse an existing conference if the name already matches (case-insensitive) — never create a duplicate.
    const existing = conferences.find(c => c.name.toLowerCase().trim() === trimmed.toLowerCase());
    if (existing) return existing;
    // Generate a slug that can't collide with an existing one (avoids the unique-constraint error).
    const used = new Set(conferences.map(c => c.slug));
    const base = slugify(trimmed) || 'conference';
    let slug = base, n = 2;
    while (used.has(slug)) { slug = `${base}_${n}`; n++; }
    const { data, error: e } = await supabase.from('conferences')
      .insert({ name: trimmed, slug, year }).select('id, name, year, slug').single();
    if (e) { setError(e.message); return null; }
    if (data) setConferences(prev => [...prev, data as Conference].sort((a, b) => a.name.localeCompare(b.name)));
    return data as Conference;
  }

  async function addLink(company: { name: string; url: string | null; id?: string }, conferenceId: string, level: string | null) {
    const url = normalizeUrl(company.url);
    const exists = links.some(l => l.conference_id === conferenceId && (url ? l.company_url === url : l.company_name.toLowerCase() === company.name.toLowerCase()));
    if (exists) return;
    const { data, error: e } = await supabase.from('company_conferences')
      .insert({ company_name: company.name, company_url: url, conference_id: conferenceId, sponsorship_level: level, company_id: company.id ?? null })
      .select('id, company_name, company_url, conference_id, sponsorship_level, company_id').single();
    if (e) { setError(e.message); return; }
    if (data) setLinks(prev => [...prev, data as Link]);
  }

  async function removeLink(link: Link) {
    const { error: e } = await supabase.from('company_conferences').delete().eq('id', link.id);
    if (e) { setError(e.message); return; }
    setLinks(prev => prev.filter(l => l.id !== link.id));
  }

  async function linkToCompany(companyUrl: string | null, companyName: string, crm: Company) {
    let q = supabase.from('company_conferences').update({ company_id: String(crm.id) });
    q = companyUrl ? q.eq('company_url', companyUrl) : q.is('company_url', null).eq('company_name', companyName);
    const { error: e } = await q;
    if (e) { setError(e.message); return; }
    setLinks(prev => prev.map(l => {
      const match = companyUrl ? l.company_url === companyUrl : (l.company_url === null && l.company_name === companyName);
      return match ? { ...l, company_id: String(crm.id) } : l;
    }));
    setMatchRowId(null);
  }

  async function setLevel(link: Link, level: string) {
    const { error: e } = await supabase.from('company_conferences').update({ sponsorship_level: level || null }).eq('id', link.id);
    if (e) { setError(e.message); return; }
    setLinks(prev => prev.map(l => l.id === link.id ? { ...l, sponsorship_level: level || null } : l));
  }

  const confSponsors = useMemo(() => {
    if (!selectedConf) return [];
    const f = confFilter.trim().toLowerCase();
    return links.filter(l => l.conference_id === selectedConf)
      .filter(l => !f || l.company_name.toLowerCase().includes(f))
      .sort((a, b) => a.company_name.localeCompare(b.company_name));
  }, [links, selectedConf, confFilter]);

  const companyResults = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return companies.filter(c => c.name.toLowerCase().includes(q)).slice(0, 25);
  }, [companies, companyQuery]);

  const selectedCompanyLinks = useMemo(() => {
    if (!selectedCompany) return new Map<string, Link>();
    const url = normalizeUrl(selectedCompany.url);
    const m = new Map<string, Link>();
    for (const l of links) {
      const match = l.company_id === String(selectedCompany.id) || (url ? l.company_url === url : l.company_name.toLowerCase() === selectedCompany.name.toLowerCase());
      if (match) m.set(l.conference_id, l);
    }
    return m;
  }, [links, selectedCompany]);

  const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' };
  const matchBadge = (l: Link) => {
    const crm = l.company_id ? companyById.get(l.company_id) : undefined;
    if (crm) return <span className="badge" style={{ background: 'rgba(29,158,117,0.12)', color: '#1d9e75' }}>CRM: {crm.name}{crm.status ? ` · ${crm.status}` : ''}</span>;
    return <span className="badge" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-tertiary)' }}>not in CRM</span>;
  };

  if (loading) return <div style={{ padding: 'var(--space-6)' }}>Loading conference data…</div>;

  const linkedCount = links.filter(l => l.company_id).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-4) 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>Conferences</h1>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
            {conferences.length} conferences · {links.length} sponsorships · {linkedCount} linked to CRM
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost" onClick={() => setShowAddConf(true)}>+ Add conference</button>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>Upload sponsors</button>
        </div>
      </div>

      {error && <div className="alert-bar" style={{ borderRadius: 'var(--radius-md)', color: '#a32d2d' }}>{error}
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setError(null)}>dismiss</button></div>}

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button className={`btn ${mode === 'conference' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('conference')}>By conference</button>
        <button className={`btn ${mode === 'company' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('company')}>By company</button>
      </div>

      {mode === 'conference' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>
          <div style={{ ...card, maxHeight: 600, overflowY: 'auto', padding: 'var(--space-2)' }}>
            {conferences.map(c => (
              <div key={c.id} onClick={() => { setSelectedConf(c.id); setConfFilter(''); setAddQuery(''); }}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)', background: selectedConf === c.id ? 'var(--accent-soft)' : 'transparent', color: selectedConf === c.id ? 'var(--accent-text)' : 'var(--text-secondary)' }}>
                <span>{c.name}</span><span style={{ color: 'var(--text-tertiary)' }}>{countByConf.get(c.id) ?? 0}</span>
              </div>
            ))}
          </div>

          <div style={card}>
            {!selectedConf && <p style={{ color: 'var(--text-tertiary)' }}>Select a conference to see its sponsors.</p>}
            {selectedConf && (
              <>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginTop: 0 }}>
                  {confById.get(selectedConf)?.name} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>· {confSponsors.length} sponsors</span>
                </h2>
                <input className="input" placeholder="Filter sponsors…" value={confFilter} onChange={e => setConfFilter(e.target.value)} style={{ marginBottom: 'var(--space-3)' }} />

                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {confSponsors.map(l => (
                    <div key={l.id} style={{ padding: '8px 4px', borderBottom: '1px solid var(--border-default)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{l.company_name}
                            {l.company_url && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {l.company_url}</span>}</span>
                          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                            {matchBadge(l)}
                            <input className="input" value={l.sponsorship_level ?? ''} placeholder="level" onChange={e => setLevel(l, e.target.value)} style={{ width: 110, height: 28, padding: '2px 8px', fontSize: 'var(--text-xs)' }} />
                            {!l.company_id && <button className="btn btn-ghost btn-sm" onClick={() => setMatchRowId(matchRowId === l.id ? null : l.id)}>match to CRM</button>}
                          </div>
                          {matchRowId === l.id && (
                            <div style={{ marginTop: 4, padding: 'var(--space-2)', background: 'var(--bg-sidebar)', borderRadius: 'var(--radius-md)' }}>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Fuzzy name matches — confirm one:</div>
                              {fuzzy(l.company_name).length === 0 && <div style={{ fontSize: 'var(--text-xs)' }}>No close matches.</div>}
                              {fuzzy(l.company_name).map(s => (
                                <div key={s.company.id} onClick={() => linkToCompany(l.company_url, l.company_name, s.company)}
                                  style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', cursor: 'pointer', fontSize: 'var(--text-xs)', borderRadius: 4 }}>
                                  <span>{s.company.name}{s.company.status ? ` · ${s.company.status}` : ''}</span>
                                  <span style={{ color: 'var(--text-tertiary)' }}>{Math.round(s.score * 100)}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => removeLink(l)}>Remove</button>
                      </div>
                    </div>
                  ))}
                  {confSponsors.length === 0 && <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No sponsors match.</p>}
                </div>

                <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                  <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Add a company to this conference</label>
                  <input className="input" placeholder="Search companies…" value={addQuery} onChange={e => setAddQuery(e.target.value)} style={{ marginTop: 6 }} />
                  {addQuery.trim().length >= 2 && (
                    <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', marginTop: 6, maxHeight: 180, overflowY: 'auto' }}>
                      {companies.filter(c => c.name.toLowerCase().includes(addQuery.trim().toLowerCase())).slice(0, 25).map(co => (
                        <div key={co.id} onClick={() => { addLink(co, selectedConf, null); setAddQuery(''); }}
                          style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-default)' }}>
                          {co.name}{co.url && <span style={{ color: 'var(--text-tertiary)' }}> · {co.url}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {mode === 'company' && (
        <div style={card}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Search for a company</label>
          <input className="input" placeholder="e.g. Commvault" value={companyQuery} onChange={e => { setCompanyQuery(e.target.value); setSelectedCompany(null); }} style={{ marginTop: 6 }} />
          {!selectedCompany && companyResults.length > 0 && (
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', marginTop: 6, maxHeight: 220, overflowY: 'auto' }}>
              {companyResults.map(co => (
                <div key={co.id} onClick={() => setSelectedCompany(co)} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-default)' }}>
                  {co.name}{co.url && <span style={{ color: 'var(--text-tertiary)' }}> · {co.url}</span>}{co.status && <span style={{ color: 'var(--text-tertiary)' }}> · {co.status}</span>}
                </div>
              ))}
            </div>
          )}
          {selectedCompany && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>{selectedCompany.name}
                  {selectedCompany.url && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}> · {selectedCompany.url}</span>}</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedCompany(null); setCompanyQuery(''); }}>Clear</button>
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Tick to add this company to a conference; untick to remove. {selectedCompanyLinks.size} linked.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {conferences.map(c => {
                  const linked = selectedCompanyLinks.get(c.id);
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', padding: '4px 2px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!linked} onChange={() => { linked ? removeLink(linked) : addLink(selectedCompany, c.id, null); }} />
                      {c.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {showAddConf && <AddConferenceModal onClose={() => setShowAddConf(false)} onAdd={addConference} />}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          conferences={conferences}
          companyByUrl={companyByUrl}
          companyByName={companyByName}
          fuzzy={fuzzy}
          onCommitted={loadAll}
          addConference={addConference}
        />
      )}
    </div>
  );
}

function AddConferenceModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, year: number | null) => Promise<Conference | null> }) {
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <ModalShell title="Add conference" onClose={onClose}>
      <label style={lbl}>Name</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. RSAC 2027" />
      <label style={lbl}>Year (optional)</label>
      <input className="input" value={year} onChange={e => setYear(e.target.value.replace(/[^0-9]/g, ''))} placeholder="2027" />
      <button className="btn btn-primary btn-lg" disabled={!name.trim() || busy} style={{ width: '100%', marginTop: 'var(--space-3)' }}
        onClick={async () => { setBusy(true); const r = await onAdd(name, year ? Number(year) : null); setBusy(false); if (r) onClose(); }}>
        {busy ? 'Adding…' : 'Add conference'}
      </button>
    </ModalShell>
  );
}

function UploadModal({ onClose, conferences, companyByUrl, companyByName, fuzzy, onCommitted, addConference }: {
  onClose: () => void;
  conferences: Conference[];
  companyByUrl: Map<string, Company>;
  companyByName: Map<string, Company>;
  fuzzy: (name: string, k?: number, t?: number) => Suggestion[];
  onCommitted: () => Promise<void>;
  addConference: (name: string, year: number | null) => Promise<Conference | null>;
}) {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [parsed, setParsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const confByName = useMemo(() => { const m = new Map<string, Conference>(); for (const c of conferences) m.set(c.name.toLowerCase().trim(), c); return m; }, [conferences]);

  function handleFile(text: string) {
    const grid = parseCSV(text);
    if (grid.length < 2) { setResult('No data rows found.'); return; }
    const header = grid[0].map(h => h.toLowerCase().trim());
    const idx = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));
    const ci = idx(['conf']); const cn = idx(['company name', 'sponsor']); const cu = idx(['url']); const cl = idx(['level']);
    if (ci < 0 || cn < 0) { setResult('CSV needs at least "conf name" and "sponsor company name" columns.'); return; }
    const out: UploadRow[] = [];
    for (let r = 1; r < grid.length; r++) {
      const g = grid[r];
      const confName = (g[ci] ?? '').trim();
      const companyName = (g[cn] ?? '').trim();
      if (!confName || !companyName) continue;
      const companyUrl = normalizeUrl(cu >= 0 ? g[cu] : null);
      const level = (cl >= 0 ? g[cl] : '').trim();
      const conf = confByName.get(confName.toLowerCase());
      let matchType: UploadRow['matchType'] = 'none'; let company: Company | undefined; let suggestions: Suggestion[] = [];
      if (companyUrl && companyByUrl.has(companyUrl)) { matchType = 'url'; company = companyByUrl.get(companyUrl); }
      else if (companyByName.has(companyName.toLowerCase())) { matchType = 'name'; company = companyByName.get(companyName.toLowerCase()); }
      else { suggestions = fuzzy(companyName); }
      out.push({ confName, companyName, companyUrl, level, conf, newConf: !conf, matchType, company, suggestions });
    }
    setRows(out); setParsed(true); setResult(null);
  }

  function chooseSuggestion(i: number, company: Company | undefined) {
    setRows(prev => prev.map((r, j) => j === i ? { ...r, company, matchType: company ? 'fuzzy' : 'none' } : r));
  }

  async function commit() {
    setBusy(true);
    try {
      // 1) Create any new conferences first
      const newNames = Array.from(new Set(rows.filter(r => r.newConf).map(r => r.confName)));
      const created = new Map<string, Conference>();
      for (const nm of newNames) { const c = await addConference(nm, null); if (c) created.set(nm.toLowerCase(), c); }

      // 2) Resolve company_id for EVERY row. Unmatched rows get a company created
      //    (url-keyed) instead of being written with a null link. Cache by canonical
      //    url so the same new company isn't created twice within one upload.
      const idByUrl = new Map<string, string>();
      let createdCompanies = 0;
      const skipped: string[] = [];

      for (const r of rows) {
        if (r.company) { if (r.companyUrl) idByUrl.set(r.companyUrl, String(r.company.id)); continue; }
        const url = r.companyUrl; // already normalizeUrl()'d in handleFile
        if (!url) { skipped.push(r.companyName || '(no name)'); continue; }
        if (idByUrl.has(url)) continue;

        // already exists at this canonical url? (covers names that didn't match but whose url does)
        const { data: hit } = await supabase.from('companies').select('id').eq('url', url).maybeSingle();
        if (hit) { idByUrl.set(url, String(hit.id)); continue; }

        // create it
        const { data: ins, error: ce } = await supabase
          .from('companies').insert({ url, name: r.companyName }).select('id').single();
        if (ce || !ins) { skipped.push(`${r.companyName} (${ce?.message ?? 'insert failed'})`); continue; }
        idByUrl.set(url, String(ins.id));
        createdCompanies++;
      }

      // 3) Build payload with a resolved company_id wherever we have one
      const payload = rows.map(r => {
        const conf = r.conf ?? created.get(r.confName.toLowerCase());
        if (!conf) return null;
        const companyId = r.company ? String(r.company.id)
                        : (r.companyUrl ? idByUrl.get(r.companyUrl) ?? null : null);
        return {
          company_name: r.companyName,
          company_url: r.companyUrl,
          conference_id: conf.id,
          sponsorship_level: r.level || null,
          company_id: companyId,
        };
      }).filter(Boolean) as Record<string, unknown>[];

      // 4) Write links
      let written = 0;
      for (let i = 0; i < payload.length; i += 500) {
        const chunk = payload.slice(i, i + 500);
        const { error } = await supabase.from('company_conferences').upsert(chunk, { onConflict: 'company_url,conference_id', ignoreDuplicates: false });
        if (error) throw error;
        written += chunk.length;
      }

      const msg = `Imported ${written} rows · created ${createdCompanies} new companies`
                + (skipped.length ? ` · skipped ${skipped.length}: ${skipped.join(', ')}` : '');
      setResult(msg);
      await onCommitted();
    } catch (e: unknown) {
      setResult(e instanceof Error ? e.message : 'Import failed.');
    } finally { setBusy(false); }
  }

  const counts = useMemo(() => ({
    url: rows.filter(r => r.matchType === 'url').length,
    name: rows.filter(r => r.matchType === 'name').length,
    fuzzy: rows.filter(r => r.matchType === 'fuzzy').length,
    none: rows.filter(r => r.matchType === 'none').length,
    newConf: new Set(rows.filter(r => r.newConf).map(r => r.confName)).size,
  }), [rows]);

  return (
    <ModalShell title="Upload sponsors" onClose={onClose} wide>
      {!parsed && (
        <>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            CSV columns: <code>conf name, sponsor company name, sponsor company url, sponsorship level</code>.
            Rows match to CRM companies by URL, then exact name, then fuzzy (you confirm). Unmatched rows now create a new company so nothing is dropped.
          </p>
          <button className="btn btn-ghost btn-sm" onClick={downloadTemplate} style={{ marginBottom: 'var(--space-3)' }}>↓ Download template CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="input"
            onChange={e => { const f = e.target.files?.[0]; if (f) f.text().then(handleFile); }} />
          {result && <p style={{ color: '#a32d2d', fontSize: 'var(--text-sm)' }}>{result}</p>}
        </>
      )}

      {parsed && (
        <>
          <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span><strong>{rows.length}</strong> rows</span>
            <span style={{ color: '#1d9e75' }}>URL: {counts.url}</span>
            <span style={{ color: '#1d9e75' }}>name: {counts.name}</span>
            <span style={{ color: '#ba7517' }}>fuzzy chosen: {counts.fuzzy}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>will create: {counts.none}</span>
            <span>new conferences: {counts.newConf}</span>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1.4fr', gap: 'var(--space-2)', padding: '6px 10px', borderBottom: '1px solid var(--border-default)', fontSize: 'var(--text-xs)', alignItems: 'center' }}>
                <span>{r.confName}{r.newConf && <span style={{ color: '#ba7517' }}> (new)</span>}</span>
                <span>{r.companyName}{r.level && <span style={{ color: 'var(--text-tertiary)' }}> · {r.level}</span>}</span>
                <span>
                  {(r.matchType === 'url' || r.matchType === 'name') && <span style={{ color: '#1d9e75' }}>✓ {r.company?.name} ({r.matchType})</span>}
                  {r.matchType === 'fuzzy' && <span style={{ color: '#ba7517' }}>≈ {r.company?.name}</span>}
                  {r.matchType === 'none' && (
                    r.suggestions.length > 0
                      ? <select className="input select" style={{ height: 28, fontSize: 'var(--text-xs)' }} defaultValue=""
                          onChange={e => chooseSuggestion(i, r.suggestions.find(s => String(s.company.id) === e.target.value)?.company)}>
                          <option value="">will create new company — or pick…</option>
                          {r.suggestions.map(s => <option key={s.company.id} value={String(s.company.id)}>{s.company.name} ({Math.round(s.score * 100)}%)</option>)}
                        </select>
                      : <span style={{ color: 'var(--text-tertiary)' }}>will create new company</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          {result && <p style={{ color: result.startsWith('Imported') ? '#1d9e75' : '#a32d2d', fontSize: 'var(--text-sm)' }}>{result}</p>}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
            <button className="btn btn-ghost" onClick={() => { setParsed(false); setRows([]); setResult(null); if (fileRef.current) fileRef.current.value = ''; }}>Back</button>
            <button className="btn btn-primary" disabled={busy} onClick={commit} style={{ flex: 1 }}>{busy ? 'Importing…' : `Import ${rows.length} rows`}</button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function downloadTemplate() {
  const csv = 'conf name,sponsor company name,sponsor company url,sponsorship level\nRSAC 2026,Acme Security,acme.io,Platinum\nRSAC 2026,Beta Defense,betadefense.com,Gold\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'aphinia_sponsors_template.csv'; a.click();
  URL.revokeObjectURL(a.href);
}

const lbl: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginTop: 'var(--space-3)', marginBottom: 'var(--space-1)' };
function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', width: '100%', maxWidth: wide ? 760 : 480, maxHeight: '88vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

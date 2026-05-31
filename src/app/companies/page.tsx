// app/companies/page.tsx
// Screen 6: Company List — filterable table with search, status filters, bulk actions

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { Company, CompanyStatus } from '@/lib/supabase-types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/supabase-types';

const supabase = createClient();

const STATUS_OPTIONS: CompanyStatus[] = ['client', 'former_client', 'prospect', 'high_value', 'acquired', 'dni', 'not_relevant'];

function StatusBadge({ status }: { status: CompanyStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span className="badge" style={{ background: `${color}14`, color: color }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | ''>('');
  const [regionFilter, setRegionFilter] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const PAGE_SIZE = 50;

  const fetchCompanies = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('companies')
      .select('*', { count: 'exact' });

    if (statusFilter) query = query.eq('status', statusFilter);
    if (regionFilter) query = query.eq('region', regionFilter);
    if (search) query = query.or(`name.ilike.%${search}%,url.ilike.%${search}%`);

    query = query.order(sortField, { ascending: sortDir === 'asc' });
    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, error, count } = await query;

    if (error) console.error('Companies fetch error:', error);
    if (data) setCompanies(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [statusFilter, regionFilter, search, sortField, sortDir, page]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortArrow = (field: string) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === companies.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(companies.map(c => c.id)));
    }
  };

  const bulkChangeStatus = async (newStatus: CompanyStatus) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await supabase.from('companies').update({ status: newStatus }).in('id', ids);
    setSelected(new Set());
    fetchCompanies();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title">Companies</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${total.toLocaleString()} companies`}
            {statusFilter && ` · ${STATUS_LABELS[statusFilter]}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-row" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ flex: '1 1 300px', maxWidth: 400 }}>
          <input
            className="input"
            placeholder="Search by name or domain…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>

        <select
          className="input select"
          style={{ width: 200 }}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as CompanyStatus | ''); setPage(0); }}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          className="input select"
          style={{ width: 180 }}
          value={regionFilter}
          onChange={e => { setRegionFilter(e.target.value); setPage(0); }}
        >
          <option value="">All Regions</option>
          <option value="North America">North America</option>
          <option value="EMEA">EMEA</option>
          <option value="APAC">APAC</option>
          <option value="LATAM">LATAM</option>
        </select>

        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginLeft: 'auto' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--accent)' }}>
              {selected.size} selected
            </span>
            <select
              className="input select"
              style={{ width: 180, fontSize: 'var(--text-xs)' }}
              defaultValue=""
              onChange={e => {
                if (e.target.value) bulkChangeStatus(e.target.value as CompanyStatus);
                e.target.value = '';
              }}
            >
              <option value="" disabled>Change status to…</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === companies.length}
                    onChange={toggleAll}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </th>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Company{sortArrow('name')}
                </th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Status{sortArrow('status')}
                </th>
                <th>Focus</th>
                <th onClick={() => handleSort('employees')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  Employees{sortArrow('employees')}
                </th>
                <th onClick={() => handleSort('conference_count')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  Conferences{sortArrow('conference_count')}
                </th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(company => (
                <tr key={company.id} onClick={() => window.location.href = `/companies/${company.id}`} style={{ cursor: 'pointer' }}>
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(company.id)}
                      onChange={() => toggleSelect(company.id)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{company.name}</span>
                      {company.url && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {company.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td><StatusBadge status={company.status} /></td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: 200 }}>
                    <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {company.focus || '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {company.employees?.toLocaleString() || '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {company.conference_count || 0}
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {[company.city, company.state].filter(Boolean).join(', ') || company.country || '—'}
                  </td>
                </tr>
              ))}
              {!loading && companies.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-tertiary)' }}>
                    No companies match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-5)' }}>
        <button
          className="btn btn-secondary btn-sm"
          disabled={page === 0}
          onClick={() => setPage(p => Math.max(0, p - 1))}
        >
          ← Previous
        </button>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Page {page + 1}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          disabled={companies.length < PAGE_SIZE}
          onClick={() => setPage(p => p + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

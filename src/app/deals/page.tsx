// app/deals/page.tsx
// Screen 2: Deal Pipeline — kanban board with drag-drop, overdue follow-ups

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { DealStatus, Deal } from '@/lib/supabase-types';
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from '@/lib/supabase-types';

const supabase = createClient();

const COLUMNS: DealStatus[] = ['draft', 'prop_sent', 'prop_signed', 'invoice_sent', 'invoice_paid', 'closed_lost'];

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function isOverdue(followUpDate: string | null): boolean {
  if (!followUpDate) return false;
  return new Date(followUpDate) <= new Date();
}

function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return '—';
  return `$${amount.toLocaleString()}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DealsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('deals')
      .select(`
        *,
        company:companies(id, name, status),
        contact:contacts(id, first_name, last_name),
        event:events(id, name, event_date)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) setDeals(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  // Group by status
  const columns = COLUMNS.map(status => ({
    status,
    label: DEAL_STAGE_LABELS[status],
    color: DEAL_STAGE_COLORS[status],
    deals: deals.filter(d => d.status === status),
  }));

  // Stats
  const overdueDeals = deals.filter(d =>
    d.follow_up_date && isOverdue(d.follow_up_date) && d.status !== 'invoice_paid' && d.status !== 'closed_lost'
  );
  const totalPipeline = deals
    .filter(d => !['invoice_paid', 'closed_lost'].includes(d.status))
    .reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalBooked = deals
    .filter(d => d.status === 'invoice_paid')
    .reduce((sum, d) => sum + (d.amount || 0), 0);

  // Drag and drop
  const handleDragStart = (dealId: string) => setDragId(dealId);
  const handleDrop = async (targetStatus: DealStatus) => {
    if (!dragId) return;
    const deal = deals.find(d => d.id === dragId);
    if (!deal || deal.status === targetStatus) { setDragId(null); return; }

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === dragId ? { ...d, status: targetStatus } : d));
    setDragId(null);

    // Build update payload with stage dates
    const update: any = { status: targetStatus, updated_at: new Date().toISOString() };
    if (targetStatus === 'prop_sent' && !deal.sent_date) update.sent_date = new Date().toISOString().slice(0, 10);
    if (targetStatus === 'prop_signed' && !deal.signed_date) update.signed_date = new Date().toISOString().slice(0, 10);
    if (targetStatus === 'invoice_sent' && !deal.invoice_date) update.invoice_date = new Date().toISOString().slice(0, 10);
    if (targetStatus === 'invoice_paid' && !deal.paid_date) update.paid_date = new Date().toISOString().slice(0, 10);

    await supabase.from('deals').update(update).eq('id', dragId);

    // If signed, auto-create event_sponsor row
    if (targetStatus === 'prop_signed' && deal.event_id) {
      await supabase.from('event_sponsors').upsert({
        event_id: deal.event_id,
        company_id: deal.company_id,
        deal_id: deal.id,
        sponsor_type: 'co_sponsor',
        amount_paid: 0,
      }, { onConflict: 'event_id,company_id' });
    }

    // If paid, update event_sponsor amount
    if (targetStatus === 'invoice_paid' && deal.event_id && deal.amount) {
      await supabase
        .from('event_sponsors')
        .update({ amount_paid: deal.amount })
        .eq('event_id', deal.event_id)
        .eq('company_id', deal.company_id);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
        <div>
          <h1 className="page-title">Deal Pipeline</h1>
          <p className="page-subtitle">Drag cards between stages</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-8)', textAlign: 'right' }}>
          <div className="stat-card">
            <span className="stat-value" style={{ color: 'var(--accent)' }}>{formatCurrency(totalPipeline)}</span>
            <span className="stat-label">In Pipeline</span>
          </div>
          <div className="stat-card">
            <span className="stat-value" style={{ color: 'var(--green)' }}>{formatCurrency(totalBooked)}</span>
            <span className="stat-label">Booked Revenue</span>
          </div>
        </div>
      </div>

      {/* Overdue alert */}
      {overdueDeals.length > 0 && (
        <div className="alert-bar" style={{ marginBottom: 'var(--space-5)' }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span>
            <strong>{overdueDeals.length} deal{overdueDeals.length > 1 ? 's' : ''} with overdue follow-ups</strong>
            {' — '}
            {overdueDeals.slice(0, 3).map(d => d.company?.name || 'Unknown').join(', ')}
            {overdueDeals.length > 3 && ` +${overdueDeals.length - 3} more`}
          </span>
        </div>
      )}

      {/* Kanban board */}
      <div className="kanban-board">
        {columns.map(col => (
          <div
            key={col.status}
            className="kanban-column"
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(col.status)}
          >
            {/* Column header */}
            <div className="kanban-column-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                <span className="kanban-column-title">{col.label}</span>
              </div>
              <span className="kanban-count">{col.deals.length}</span>
            </div>

            {/* Deal amount total for column */}
            {col.deals.length > 0 && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(col.deals.reduce((s, d) => s + (d.amount || 0), 0))}
              </div>
            )}

            {/* Cards */}
            {col.deals.map(deal => {
              const overdue = isOverdue(deal.follow_up_date) && !['invoice_paid', 'closed_lost'].includes(deal.status);
              return (
                <div
                  key={deal.id}
                  className={`kanban-card ${overdue ? 'overdue' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(deal.id)}
                  style={{ opacity: dragId === deal.id ? 0.4 : 1 }}
                >
                  {/* Company name */}
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                    {deal.company?.name || 'Unknown'}
                  </div>

                  {/* Event */}
                  {deal.event && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', fontWeight: 500, marginBottom: 'var(--space-2)' }}>
                      {deal.event.name}
                      {deal.event.event_date && ` · ${formatDate(deal.event.event_date)}`}
                    </div>
                  )}

                  {/* Contact */}
                  {deal.contact && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                      {[deal.contact.first_name, deal.contact.last_name].filter(Boolean).join(' ')}
                    </div>
                  )}

                  {/* Amount + days in stage */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(deal.amount)}
                    </span>
                    {deal.created_at && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {daysSince(deal.created_at)}d
                      </span>
                    )}
                  </div>

                  {/* Follow-up */}
                  {deal.follow_up_date && (
                    <div style={{
                      marginTop: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      color: overdue ? 'var(--red)' : 'var(--text-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                    }}>
                      {overdue ? '⚠️' : '📅'} Follow up {formatDate(deal.follow_up_date)}
                    </div>
                  )}

                  {/* Spark referral badge */}
                  {deal.spark_referral && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <span className="badge badge-purple" style={{ fontSize: 11 }}>Spark ⚡</span>
                    </div>
                  )}
                </div>
              );
            })}

            {col.deals.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                No deals
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

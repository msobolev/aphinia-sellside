'use client'

import { useEffect, useState, useCallback } from 'react'
import Shell from '@/components/Shell'
import { supabase } from '@/lib/supabase'
import { Contact, Event, Company, PERSONA_LABELS, WARMTH_LABELS, STATUS_LABELS } from '@/lib/types'

interface PitchCandidate extends Contact {
  company?: Company
}

interface EventWithInventory extends Event {
  sponsors_confirmed: number
  slots_available: number
}

export default function PitchPage() {
  const [events, setEvents] = useState<EventWithInventory[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<PitchCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  // Filters
  const [personaFilter, setPersonaFilter] = useState<string>('')
  const [warmthFilter, setWarmthFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [minConfs, setMinConfs] = useState(0)

  // Selection for wave
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    const { data } = await supabase
      .from('event_inventory')
      .select('*')
      .gt('slots_available', 0)
      .order('event_date', { ascending: true })
    setEvents((data as EventWithInventory[]) || [])
    setLoading(false)
  }

  const loadCandidates = useCallback(async (eventId: string) => {
    setLoadingCandidates(true)
    setSelected(new Set())

    // Get contacts already pitched for campaigns on this event
    const { data: pitchedData } = await supabase
      .from('campaigns')
      .select('id')
      .eq('event_id', eventId)
    const campaignIds = (pitchedData || []).map((c: { id: string }) => c.id)

    let pitchedContactIds: string[] = []
    if (campaignIds.length > 0) {
      const { data: targetData } = await supabase
        .from('campaign_targets')
        .select('contact_id')
        .in('campaign_id', campaignIds)
      pitchedContactIds = (targetData || []).map((t: { contact_id: string }) => t.contact_id)
    }

    // Get eligible contacts with company data
    let query = supabase
      .from('contacts')
      .select('*, company:companies(*)')
      .not('email', 'is', null)
      .neq('warmth', 'dni')
      .neq('email_status', 'bounced')
      .order('warmth', { ascending: true })
      .limit(500)

    const { data } = await query

    let filtered = (data || []) as PitchCandidate[]

    // Filter out DNI / not_relevant / acquired companies
    filtered = filtered.filter(c =>
      c.company &&
      !['dni', 'not_relevant', 'acquired'].includes(c.company.status)
    )

    // Filter out already-pitched contacts
    if (pitchedContactIds.length > 0) {
      filtered = filtered.filter(c => !pitchedContactIds.includes(c.id))
    }

    // Sort: hot > warm > cool > cold, then client > prospect > high_value, then conference_count desc
    const warmthOrder: Record<string, number> = { hot: 0, warm: 1, cool: 2, cold: 3 }
    const statusOrder: Record<string, number> = { client: 0, prospect: 1, high_value: 2, former_client: 3 }
    filtered.sort((a, b) => {
      const wA = warmthOrder[a.warmth] ?? 4
      const wB = warmthOrder[b.warmth] ?? 4
      if (wA !== wB) return wA - wB
      const sA = statusOrder[a.company?.status || ''] ?? 5
      const sB = statusOrder[b.company?.status || ''] ?? 5
      if (sA !== sB) return sA - sB
      return (b.company?.conference_count || 0) - (a.company?.conference_count || 0)
    })

    setCandidates(filtered)
    setLoadingCandidates(false)
  }, [])

  useEffect(() => {
    if (selectedEvent) loadCandidates(selectedEvent)
  }, [selectedEvent, loadCandidates])

  // Apply local filters
  const displayed = candidates.filter(c => {
    if (personaFilter && c.persona !== personaFilter) return false
    if (warmthFilter && c.warmth !== warmthFilter) return false
    if (statusFilter && c.company?.status !== statusFilter) return false
    if (minConfs && (c.company?.conference_count || 0) < minConfs) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase()
      const co = c.company?.name?.toLowerCase() || ''
      if (!name.includes(term) && !co.includes(term) && !(c.email || '').toLowerCase().includes(term)) return false
    }
    return true
  })

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === displayed.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(displayed.map(c => c.id)))
    }
  }

  const warmthDot = (w: string) => {
    const colors: Record<string, string> = {
      hot: 'var(--hot)', warm: 'var(--warm)', cool: 'var(--cool)', cold: 'var(--cold)', dni: 'var(--danger)'
    }
    return <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: colors[w] || 'var(--cold)' }} />
  }

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      client: 'var(--client)', prospect: 'var(--prospect)', high_value: 'var(--high-value)',
      former_client: 'var(--text-dim)'
    }
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide"
        style={{ background: `${colors[s] || 'var(--cold)'}22`, color: colors[s] || 'var(--cold)' }}>
        {STATUS_LABELS[s] || s}
      </span>
    )
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-dim)' }}>
          Loading...
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="flex h-full">
        {/* Left: Event selector */}
        <div className="w-72 shrink-0 border-r overflow-auto p-4" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
            Events with open slots
          </h2>
          {events.length === 0 ? (
            <div className="text-sm py-8 text-center" style={{ color: 'var(--text-dim)' }}>
              No events with open inventory.
              <br />
              <a href="/events" className="underline" style={{ color: 'var(--accent)' }}>Create an event</a>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {events.map(e => (
                <button key={e.id}
                  onClick={() => setSelectedEvent(e.id)}
                  className="text-left p-3 rounded-lg border transition-colors"
                  style={{
                    borderColor: selectedEvent === e.id ? 'var(--accent-dim)' : 'var(--border)',
                    background: selectedEvent === e.id ? 'var(--bg-hover)' : 'transparent',
                  }}>
                  <div className="font-medium text-sm">{e.name}</div>
                  <div className="text-xs mt-1 flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                    <span>{e.event_date ? new Date(e.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}</span>
                    <span>{e.city || ''}</span>
                  </div>
                  <div className="text-xs mt-1.5 flex items-center gap-2">
                    <span className="font-medium" style={{ color: e.slots_available > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {e.slots_available} slot{e.slots_available !== 1 ? 's' : ''} open
                    </span>
                    <span style={{ color: 'var(--text-dim)' }}>
                      of {e.max_sponsors}
                    </span>
                    {e.format !== 'dinner' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                        {e.format}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Candidates */}
        <div className="flex-1 overflow-auto">
          {!selectedEvent ? (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-dim)' }}>
              <div className="text-center">
                <div className="text-4xl mb-3">⚡</div>
                <div className="text-lg font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Select an event</div>
                <div className="text-sm">Pick an event to see who to pitch</div>
              </div>
            </div>
          ) : (
            <div className="p-4">
              {/* Filters bar */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <input type="text" placeholder="Search name, company, email..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-64 text-sm" />
                <select value={personaFilter} onChange={e => setPersonaFilter(e.target.value)} className="text-sm">
                  <option value="">All personas</option>
                  {Object.entries(PERSONA_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <select value={warmthFilter} onChange={e => setWarmthFilter(e.target.value)} className="text-sm">
                  <option value="">All warmth</option>
                  {['hot', 'warm', 'cool', 'cold'].map(w => (
                    <option key={w} value={w}>{WARMTH_LABELS[w]}</option>
                  ))}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm">
                  <option value="">All statuses</option>
                  {['client', 'prospect', 'high_value', 'former_client'].map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <select value={String(minConfs)} onChange={e => setMinConfs(Number(e.target.value))} className="text-sm">
                  <option value="0">Any confs</option>
                  <option value="3">3+ confs</option>
                  <option value="5">5+ confs</option>
                </select>
                <div className="ml-auto text-sm" style={{ color: 'var(--text-dim)' }}>
                  {displayed.length} candidates
                  {selected.size > 0 && (
                    <span style={{ color: 'var(--accent)' }}> · {selected.size} selected</span>
                  )}
                </div>
              </div>

              {loadingCandidates ? (
                <div className="text-center py-12" style={{ color: 'var(--text-dim)' }}>Loading candidates...</div>
              ) : (
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--bg-card)' }}>
                        <th className="w-10 px-3 py-2.5 text-left">
                          <input type="checkbox"
                            checked={displayed.length > 0 && selected.size === displayed.length}
                            onChange={selectAll}
                            className="rounded" />
                        </th>
                        <th className="px-3 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Contact</th>
                        <th className="px-3 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Company</th>
                        <th className="px-3 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Persona</th>
                        <th className="px-3 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Warmth</th>
                        <th className="px-3 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Confs</th>
                        <th className="px-3 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.slice(0, 100).map(c => (
                        <tr key={c.id}
                          className="border-t transition-colors cursor-pointer"
                          style={{ borderColor: 'var(--border)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          onClick={() => toggleSelect(c.id)}>
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={selected.has(c.id)}
                              onChange={() => toggleSelect(c.id)}
                              className="rounded" />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{c.first_name} {c.last_name}</div>
                            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{c.title}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span>{c.company?.name}</span>
                              {c.company && statusBadge(c.company.status)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>
                            {c.persona ? PERSONA_LABELS[c.persona] || c.persona : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center">
                              {warmthDot(c.warmth)}
                              {WARMTH_LABELS[c.warmth]}
                            </span>
                          </td>
                          <td className="px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>
                            {c.company?.conference_count || 0}
                          </td>
                          <td className="px-3 py-2.5 max-w-xs truncate text-xs" style={{ color: 'var(--text-dim)' }}>
                            {c.crm_context || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {displayed.length > 100 && (
                    <div className="text-center py-3 text-xs" style={{ color: 'var(--text-dim)', background: 'var(--bg-card)' }}>
                      Showing first 100 of {displayed.length} candidates
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}

export interface Company {
  id: string
  name: string
  url: string
  linkedin: string | null
  focus: string | null
  city: string | null
  state: string | null
  country: string | null
  region: string | null
  address_raw: string | null
  employees: number | null
  description: string | null
  status: 'client' | 'former_client' | 'prospect' | 'high_value' | 'acquired' | 'dni' | 'not_relevant'
  rank_raw: string | null
  conference_count: number
  tag: string | null
  comment: string | null
  created_at: string
  updated_at: string
  // from company_360 view
  contact_count?: number
  deal_count?: number
  total_revenue?: number
  conferences_sponsored?: number
  interaction_count?: number
  last_interaction?: string | null
}

export interface Contact {
  id: string
  company_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  title: string | null
  persona: 'cmo_cro' | 'field_marketing' | 'demand_gen' | 'events' | 'channel_alliance' | 'director_marketing' | 'marketing_other' | 'regional_sales' | null
  warmth: 'hot' | 'warm' | 'cool' | 'cold' | 'dni'
  seniority: string | null
  departments: string | null
  sub_departments: string | null
  linkedin: string | null
  phone: string | null
  mobile: string | null
  city: string | null
  state: string | null
  country: string | null
  email_status: 'verified' | 'bounced' | 'unknown'
  crm_context: string | null
  crm_source: string | null
  employee_count: number | null
  industry: string | null
  annual_revenue: number | null
  created_at: string
  updated_at: string
  // joined
  company?: Company
}

export interface Event {
  id: string
  name: string
  event_date: string | null
  city: string | null
  region: string | null
  format: 'dinner' | 'breakfast' | 'shark_tank' | 'briefing' | 'other'
  conference_association: string | null
  max_sponsors: number
  price_per_slot: number | null
  sponsor_model: 'exclusive_only' | 'co_sponsor' | 'flexible'
  revenue_target: number | null
  revenue_booked: number
  notes: string | null
  created_at: string
  updated_at: string
  // from event_inventory view
  sponsors_confirmed?: number
  slots_available?: number
  revenue_collected?: number
}

export interface Deal {
  id: string
  company_id: string
  contact_id: string | null
  event_id: string | null
  amount: number | null
  status: 'draft' | 'prop_sent' | 'prop_signed' | 'invoice_sent' | 'invoice_paid' | 'closed_lost'
  sent_date: string | null
  signed_date: string | null
  invoice_date: string | null
  paid_date: string | null
  follow_up_date: string | null
  spark_referral: boolean
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  company?: Company
  contact?: Contact
  event?: Event
}

export interface Interaction {
  id: string
  company_id: string | null
  contact_id: string | null
  source: 'rsac' | 'blackhat' | 'cybermktgcon' | 'dinner' | 'call' | 'email' | 'linkedin' | 'conference_other' | 'other'
  interaction_date: string
  content: string
  follow_up: string | null
  follow_up_date: string | null
  created_at: string
  company?: Company
  contact?: Contact
}

export interface Conference {
  id: string
  name: string
  slug: string
  year: number | null
}

export interface Campaign {
  id: string
  name: string
  event_id: string | null
  wave: number | null
  channel: 'gmail' | 'instantly' | 'linkedin' | 'other' | null
  template_name: string | null
  sent_date: string | null
  created_at: string
}

export interface CampaignTarget {
  id: string
  campaign_id: string
  contact_id: string
  date_sent: string | null
  date_replied: string | null
}

export const PERSONA_LABELS: Record<string, string> = {
  cmo_cro: 'CMO/CRO',
  field_marketing: 'Field Marketing',
  demand_gen: 'Demand Gen',
  events: 'Events',
  channel_alliance: 'Channel/Alliance',
  director_marketing: 'Director Marketing',
  marketing_other: 'Marketing (Other)',
  regional_sales: 'Regional Sales',
}

export const STATUS_LABELS: Record<string, string> = {
  client: 'Client',
  former_client: 'Former Client',
  prospect: 'Prospect',
  high_value: 'High Value',
  acquired: 'Acquired',
  dni: 'DNI',
  not_relevant: 'Not Relevant',
}

export const WARMTH_LABELS: Record<string, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cool: 'Cool',
  cold: 'Cold',
  dni: 'DNI',
}

export const DEAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  prop_sent: 'Prop Sent',
  prop_signed: 'Prop Signed',
  invoice_sent: 'Invoice Sent',
  invoice_paid: 'Invoice Paid',
  closed_lost: 'Closed Lost',
}

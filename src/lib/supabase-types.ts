// lib/supabase-types.ts
// Type definitions matching the Aphinia Sellside CRM schema

export type CompanyStatus = 'client' | 'former_client' | 'prospect' | 'high_value' | 'acquired' | 'dni' | 'not_relevant';
export type ContactWarmth = 'hot' | 'warm' | 'cool' | 'cold' | 'dni';
export type ContactPersona = 'cmo_cro' | 'field_marketing' | 'demand_gen' | 'events' | 'channel_alliance' | 'director_marketing' | 'marketing_other' | 'regional_sales';
export type DealStatus = 'draft' | 'prop_sent' | 'prop_signed' | 'invoice_sent' | 'invoice_paid' | 'closed_lost';
export type EventFormat = 'dinner' | 'breakfast' | 'shark_tank' | 'briefing' | 'other';
export type SponsorModel = 'exclusive_only' | 'co_sponsor' | 'flexible';
export type SponsorType = 'exclusive' | 'co_sponsor' | 'vendor_slot';
export type InteractionSource = 'rsac' | 'blackhat' | 'cybermktgcon' | 'dinner' | 'call' | 'email' | 'linkedin' | 'conference_other' | 'other';

export interface Company {
  id: string;
  name: string;
  url: string;
  linkedin?: string;
  focus?: string;
  city?: string;
  state?: string;
  country: string;
  region?: string;
  address_raw?: string;
  employees?: number;
  description?: string;
  status: CompanyStatus;
  rank_raw?: string;
  conference_count: number;
  tag?: string;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  company_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  title?: string;
  persona?: ContactPersona;
  warmth: ContactWarmth;
  seniority?: string;
  departments?: string;
  sub_departments?: string;
  linkedin?: string;
  phone?: string;
  mobile?: string;
  city?: string;
  state?: string;
  country?: string;
  email_status: 'verified' | 'bounced' | 'unknown';
  crm_context?: string;
  crm_source?: string;
  employee_count?: number;
  industry?: string;
  annual_revenue?: number;
  created_at: string;
  updated_at: string;
  // joined
  company?: Company;
}

export interface Deal {
  id: string;
  company_id: string;
  contact_id?: string;
  event_id?: string;
  amount?: number;
  status: DealStatus;
  sent_date?: string;
  signed_date?: string;
  invoice_date?: string;
  paid_date?: string;
  follow_up_date?: string;
  spark_referral: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined
  company?: Company;
  contact?: Contact;
  event?: Event;
}

export interface Event {
  id: string;
  name: string;
  event_date?: string;
  city?: string;
  region?: string;
  format: EventFormat;
  conference_association?: string;
  max_sponsors: number;
  price_per_slot?: number;
  sponsor_model: SponsorModel;
  revenue_target?: number;
  revenue_booked: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // computed
  sponsors_confirmed?: number;
  slots_available?: number;
}

export interface EventSponsor {
  id: string;
  event_id: string;
  company_id: string;
  deal_id?: string;
  sponsor_type: SponsorType;
  amount_paid: number;
  created_at: string;
  company?: Company;
  deal?: Deal;
}

export interface Interaction {
  id: string;
  company_id?: string;
  contact_id?: string;
  source: InteractionSource;
  interaction_date: string;
  content: string;
  follow_up?: string;
  follow_up_date?: string;
  created_at: string;
  company?: Company;
  contact?: Contact;
}

export interface Conference {
  id: string;
  name: string;
  slug: string;
  year?: number;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  event_id?: string;
  wave?: number;
  channel?: 'gmail' | 'instantly' | 'linkedin' | 'other';
  template_name?: string;
  sent_date?: string;
  created_at: string;
  event?: Event;
}

// Display helpers
export const STATUS_LABELS: Record<CompanyStatus, string> = {
  client: 'Client',
  former_client: 'Former Client',
  prospect: 'Prospect',
  high_value: 'High Value',
  acquired: 'Acquired',
  dni: 'DNI',
  not_relevant: 'Not Relevant',
};

export const STATUS_COLORS: Record<CompanyStatus, string> = {
  client: '#16a34a',
  former_client: '#ca8a04',
  prospect: '#2563eb',
  high_value: '#7c3aed',
  acquired: '#6b7280',
  dni: '#dc2626',
  not_relevant: '#9ca3af',
};

export const WARMTH_LABELS: Record<ContactWarmth, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cool: 'Cool',
  cold: 'Cold',
  dni: 'DNI',
};

export const WARMTH_COLORS: Record<ContactWarmth, string> = {
  hot: '#dc2626',
  warm: '#ea580c',
  cool: '#2563eb',
  cold: '#6b7280',
  dni: '#1f2937',
};

export const DEAL_STAGE_LABELS: Record<DealStatus, string> = {
  draft: 'Draft',
  prop_sent: 'Proposal Sent',
  prop_signed: 'Signed',
  invoice_sent: 'Invoice Sent',
  invoice_paid: 'Paid',
  closed_lost: 'Closed Lost',
};

export const DEAL_STAGE_COLORS: Record<DealStatus, string> = {
  draft: '#6b7280',
  prop_sent: '#2563eb',
  prop_signed: '#7c3aed',
  invoice_sent: '#ca8a04',
  invoice_paid: '#16a34a',
  closed_lost: '#dc2626',
};

export const PERSONA_LABELS: Record<ContactPersona, string> = {
  cmo_cro: 'CMO/CRO',
  field_marketing: 'Field Marketing',
  demand_gen: 'Demand Gen',
  events: 'Events',
  channel_alliance: 'Channel/Alliance',
  director_marketing: 'Director Marketing',
  marketing_other: 'Marketing (Other)',
  regional_sales: 'Regional Sales',
};

export const FORMAT_LABELS: Record<EventFormat, string> = {
  dinner: 'Dinner',
  breakfast: 'Breakfast',
  shark_tank: 'Shark Tank',
  briefing: 'Briefing',
  other: 'Other',
};

export const SOURCE_LABELS: Record<InteractionSource, string> = {
  rsac: 'RSAC',
  blackhat: 'Black Hat',
  cybermktgcon: 'CyberMktgCon',
  dinner: 'Dinner',
  call: 'Call',
  email: 'Email',
  linkedin: 'LinkedIn',
  conference_other: 'Conference (Other)',
  other: 'Other',
};

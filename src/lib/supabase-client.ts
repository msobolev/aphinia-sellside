import { createClient as create } from '@supabase/supabase-js';
export const createClient = () => create(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

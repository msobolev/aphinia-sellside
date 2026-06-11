-- Run this once in the Supabase SQL Editor (or via psql as a superuser).
-- Replace 'CHOOSE_A_STRONG_PASSWORD' with your actual password before running.
-- Then use this role's connection string as AGENT_DATABASE_URL.

-- 1. Create the role
CREATE ROLE agent_readonly WITH
  LOGIN
  PASSWORD 'CHOOSE_A_STRONG_PASSWORD'
  CONNECTION LIMIT 5;

-- 2. Force all sessions for this role to be read-only at the DB level
ALTER ROLE agent_readonly SET default_transaction_read_only = on;

-- 3. Grant SELECT on the four core tables
GRANT USAGE ON SCHEMA public TO agent_readonly;
GRANT SELECT ON public.companies  TO agent_readonly;
GRANT SELECT ON public.contacts   TO agent_readonly;
GRANT SELECT ON public.deals      TO agent_readonly;
GRANT SELECT ON public.events     TO agent_readonly;

-- 4. Also grant SELECT on information_schema views used for live schema introspection
GRANT SELECT ON information_schema.columns                   TO agent_readonly;
GRANT SELECT ON information_schema.table_constraints         TO agent_readonly;
GRANT SELECT ON information_schema.key_column_usage          TO agent_readonly;
GRANT SELECT ON information_schema.constraint_column_usage   TO agent_readonly;

-- Verification (run separately after connecting as agent_readonly):
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN ('companies','contacts','deals','events');

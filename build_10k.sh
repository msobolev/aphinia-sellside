#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# 10K Agent – build script for aphinia-sellside
# Run from repo root: bash build_10k.sh
# ─────────────────────────────────────────────

echo "→ Detecting layout and package manager..."

# Detect app root
if [ -d "src/app" ]; then
  APP="src/app"
else
  APP="app"
fi

# Detect package manager
if [ -f "pnpm-lock.yaml" ]; then PM="pnpm"
elif [ -f "yarn.lock" ]; then PM="yarn"
else PM="npm"
fi

echo "  Layout: $APP"
echo "  Package manager: $PM"

# ─────────────────────────────────────────────
# 1. Install dependencies
# ─────────────────────────────────────────────
echo "→ Installing pg and @anthropic-ai/sdk..."
if [ "$PM" = "pnpm" ]; then
  pnpm add pg @anthropic-ai/sdk
  pnpm add -D @types/pg
elif [ "$PM" = "yarn" ]; then
  yarn add pg @anthropic-ai/sdk
  yarn add -D @types/pg
else
  npm install pg @anthropic-ai/sdk
  npm install -D @types/pg
fi

# ─────────────────────────────────────────────
# 2. lib/agent/context.ts
# ─────────────────────────────────────────────
mkdir -p lib/agent

cat > lib/agent/context.ts << 'CONTEXT'
// Business context injected into every 10K query.
// This is the single biggest lever on SQL quality — keep it accurate.

export const BUSINESS_CONTEXT = `
You are 10K, a read-only data analyst for Aphinia — a B2B event sponsorship company
that sells to cybersecurity vendors. You answer questions by writing a single PostgreSQL
SELECT query against the live database, then summarizing the result in plain English.

## Schema (public schema, Supabase/Postgres)

### companies
id (uuid PK), name (text), url (text — canonical dedupe key), status (text — tier/priority;
"high_value" is top tier), city, state, country, region, focus, employees (int), description,
tag, comment, created_at, updated_at.

### contacts
id (uuid PK), company_id (uuid FK → companies.id), first_name, last_name, email, title,
persona, warmth, seniority, crm_context, crm_source.

### events
id (uuid PK), name (text), event_date (date), city, region, format (text — THIS is the
product type: "Dinner", "SharkTank", "Breakfast"; Briefings are sold but have NO event row),
conference_association (text, e.g. "Black Hat", "RSAC", "Re:Invent", "FalCon"),
max_sponsors (int), price_per_slot (int), sponsor_model (text: "co_sponsor" or "exclusive"),
revenue_target (int), revenue_booked (int), notes.

### deals
id (uuid PK), company_id (uuid FK → companies.id — always present), contact_id (uuid FK →
contacts.id — often NULL on older rows), event_id (uuid FK → events.id — NULL means early-
stage opportunity with no event assigned yet), amount (int, USD), status (text), sent_date
(timestamptz), signed_date (timestamptz), invoice_date (timestamptz), paid_date (timestamptz),
follow_up_date (date), spark_referral (bool), notes, probability (int), created_at, updated_at.

## Critical semantics

Deal STATUS lifecycle (low → high commitment):
  opportunity   → early/unqualified (inbound leads, cold intros, no proposal yet)
  prop_sent     → proposal has been sent; awaiting decision
  prop_signed   → WON; deal exits active pipeline
  closed_lost   → lost
  no_inventory  → wanted in but no slot available
  refunded      → was signed, then refunded

Active pipeline = status IN ('opportunity', 'prop_sent')
Won = status = 'prop_signed'
NEVER count closed_lost / no_inventory / refunded as pipeline or revenue.

Deal PRODUCT TYPE comes from events.format (via event_id JOIN), not a column on deals.
event_id can be NULL — those are real pipeline deals (do not inner-join them away when
counting total pipeline).

Slot availability for an event:
  remaining = events.max_sponsors
              - COUNT of deals WHERE event_id = events.id AND status IN ('prop_signed','prop_sent')

spark_referral = true means the deal was sourced via David Spark (CISO Series partner).

FORTINET: this company is a permanent Do-Not-Invite. Never suggest outreach to it.
Never include Fortinet in recommendations or "companies to contact" outputs.

sent_date: auto-stamped by a DB trigger when status moves to prop_sent/prop_signed on new rows.
Older backfilled rows have approximate sent_dates (proposal email date where known, else
created_at proxy). Treat very old sent_dates as approximate.

companies.status = "high_value" is the top-priority tier (Tier 1).
`.trim();
CONTEXT

echo "  ✓ lib/agent/context.ts"

# ─────────────────────────────────────────────
# 3. lib/agent/schema.ts
# ─────────────────────────────────────────────
cat > lib/agent/schema.ts << 'SCHEMA'
import { Pool } from 'pg';

let cachedSchema: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function getLiveSchema(pool: Pool): Promise<string> {
  const now = Date.now();
  if (cachedSchema && now < cacheExpiry) return cachedSchema;

  // Columns
  const colRes = await pool.query(`
    SELECT
      c.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name IN ('companies','contacts','deals','events')
    ORDER BY c.table_name, c.ordinal_position
  `);

  // Foreign keys
  const fkRes = await pool.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name  AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name IN ('companies','contacts','deals','events')
  `);

  // Distinct status values for deals and companies
  const dealStatuses = await pool.query(
    `SELECT DISTINCT status FROM deals WHERE status IS NOT NULL ORDER BY status`
  );
  const companyStatuses = await pool.query(
    `SELECT DISTINCT status FROM companies WHERE status IS NOT NULL ORDER BY status`
  );
  const eventFormats = await pool.query(
    `SELECT DISTINCT format FROM events WHERE format IS NOT NULL ORDER BY format`
  );

  // Build schema string
  const byTable: Record<string, string[]> = {};
  for (const row of colRes.rows) {
    if (!byTable[row.table_name]) byTable[row.table_name] = [];
    byTable[row.table_name].push(
      `  ${row.column_name} (${row.data_type}${row.is_nullable === 'NO' ? ', NOT NULL' : ''})`
    );
  }

  const fkLines: string[] = [];
  for (const row of fkRes.rows) {
    fkLines.push(
      `  ${row.table_name}.${row.column_name} → ${row.foreign_table}.${row.foreign_column}`
    );
  }

  const lines: string[] = ['## Live Schema (auto-introspected)\n'];
  for (const [table, cols] of Object.entries(byTable)) {
    lines.push(`### ${table}`);
    lines.push(cols.join('\n'));
    lines.push('');
  }

  lines.push('### Foreign Keys');
  lines.push(fkLines.join('\n'));
  lines.push('');
  lines.push(
    `### Distinct deals.status values: ${dealStatuses.rows.map((r) => r.status).join(', ')}`
  );
  lines.push(
    `### Distinct companies.status values: ${companyStatuses.rows.map((r) => r.status).join(', ')}`
  );
  lines.push(
    `### Distinct events.format values: ${eventFormats.rows.map((r) => r.format).join(', ')}`
  );

  cachedSchema = lines.join('\n');
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedSchema;
}
SCHEMA

echo "  ✓ lib/agent/schema.ts"

# ─────────────────────────────────────────────
# 4. lib/agent/guard.ts
# ─────────────────────────────────────────────
cat > lib/agent/guard.ts << 'GUARD'
// App-layer SQL guard — defense-in-depth on top of the read-only DB role.

const DML_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|CALL|DO|COPY|VACUUM|ANALYZE)\b/i;

const CHAINED_STATEMENT =
  /;[\s\S]*?(SELECT|WITH|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)/i;

export interface GuardResult {
  ok: boolean;
  error?: string;
  sql?: string;
}

const DEFAULT_LIMIT = 200;

export function guardSQL(raw: string): GuardResult {
  const sql = raw.trim().replace(/;+$/, ''); // strip trailing semicolons

  // Must start with SELECT or WITH
  if (!/^(SELECT|WITH)\b/i.test(sql)) {
    return { ok: false, error: 'Query must start with SELECT or WITH.' };
  }

  // No DML / DDL keywords anywhere
  if (DML_PATTERN.test(sql)) {
    return { ok: false, error: 'Query contains a disallowed keyword (DML/DDL).' };
  }

  // No chained statements via semicolons
  if (CHAINED_STATEMENT.test(sql)) {
    return { ok: false, error: 'Multiple statements are not allowed.' };
  }

  // Inject LIMIT if missing
  const hasLimit = /\bLIMIT\s+\d+/i.test(sql);
  const safeSql = hasLimit ? sql : `${sql}\nLIMIT ${DEFAULT_LIMIT}`;

  return { ok: true, sql: safeSql };
}
GUARD

echo "  ✓ lib/agent/guard.ts"

# ─────────────────────────────────────────────
# 5. app/api/agent/route.ts
# ─────────────────────────────────────────────
mkdir -p "${APP}/api/agent"

cat > "${APP}/api/agent/route.ts" << 'ROUTE'
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Pool } from 'pg';
import { getLiveSchema } from '@/lib/agent/schema';
import { guardSQL } from '@/lib/agent/guard';
import { BUSINESS_CONTEXT } from '@/lib/agent/context';

// Shared pool (re-used across requests in the same serverless instance)
let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.AGENT_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { question, history = [] } = await req.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Missing question.' }, { status: 400 });
    }

    const pg = getPool();
    const liveSchema = await getLiveSchema(pg);

    const systemPrompt = `${BUSINESS_CONTEXT}

${liveSchema}

## Your job
The user will ask a business question. Respond with ONLY a JSON object (no markdown fences,
no prose outside the JSON) in exactly this shape:
{
  "sql": "<single SELECT or WITH query>",
  "explanation": "<one sentence describing what the query does>"
}

Rules:
- One query only. Must start with SELECT or WITH.
- No DML, DDL, or multiple statements.
- Use JOINs where needed; prefer LEFT JOIN so null event_id deals are not dropped.
- Do not hardcode UUIDs or company names in WHERE clauses unless the user specifically names one.
- For date math use NOW() and interval syntax.
- Never suggest outreach to Fortinet.
`;

    const messages: Anthropic.MessageParam[] = [
      ...(history as Anthropic.MessageParam[]),
      { role: 'user', content: question },
    ];

    const model = process.env.AGENT_MODEL ?? 'claude-sonnet-4-20250514';

    const sqlResponse = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const rawText =
      sqlResponse.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('') ?? '';

    let parsed: { sql: string; explanation: string };
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'Model returned unparseable response.', raw: rawText },
        { status: 500 }
      );
    }

    // Guard
    const guard = guardSQL(parsed.sql);
    if (!guard.ok) {
      return NextResponse.json(
        { error: `SQL guard rejected query: ${guard.error}`, sql: parsed.sql },
        { status: 400 }
      );
    }

    // Run
    let rows: Record<string, unknown>[];
    try {
      const result = await pg.query(guard.sql!);
      rows = result.rows;
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      return NextResponse.json(
        { error: `Database error: ${msg}`, sql: guard.sql },
        { status: 500 }
      );
    }

    // Summarize
    const summaryPrompt = `The user asked: "${question}"

The query returned ${rows.length} row(s):
${JSON.stringify(rows.slice(0, 50), null, 2)}

Write a concise plain-English answer (2-4 sentences). Be specific — include numbers.
Do not repeat the SQL. If the result is empty, say so and suggest why.`;

    const summaryResponse = await anthropic.messages.create({
      model,
      max_tokens: 512,
      messages: [{ role: 'user', content: summaryPrompt }],
    });

    const answer =
      summaryResponse.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('') ?? '(no answer)';

    return NextResponse.json({
      answer,
      sql: guard.sql,
      rows,
      rowCount: rows.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
ROUTE

echo "  ✓ ${APP}/api/agent/route.ts"

# ─────────────────────────────────────────────
# 6. app/agent/page.tsx
# ─────────────────────────────────────────────
mkdir -p "${APP}/agent"

cat > "${APP}/agent/page.tsx" << 'PAGE'
'use client';

import { useState, useRef, useEffect } from 'react';

interface Turn {
  role: 'user' | 'assistant';
  question?: string;
  answer?: string;
  sql?: string;
  rows?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
}

const SUGGESTED = [
  'Total pipeline value by stage right now',
  'Which high-value companies have an open deal but no contact logged?',
  'Shark Tank slots still unsold — compare max sponsors to signed/sent count',
  'Open deals not touched in 14+ days',
  'Revenue booked vs. target by event',
  'Which deals came via David Spark?',
  'Co-sponsor slots remaining per upcoming event',
  'All prop_sent deals where sent_date is null',
];

export default function AgentPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSQL, setExpandedSQL] = useState<Set<number>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  function buildHistory() {
    const history: { role: string; content: string }[] = [];
    for (const t of turns) {
      if (t.role === 'user' && t.question) {
        history.push({ role: 'user', content: t.question });
      }
      if (t.role === 'assistant' && t.answer) {
        history.push({ role: 'assistant', content: t.answer });
      }
    }
    return history;
  }

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setInput('');
    setLoading(true);

    const userTurn: Turn = { role: 'user', question };
    setTurns((prev) => [...prev, userTurn]);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: buildHistory() }),
      });
      const data = await res.json();
      const assistantTurn: Turn = {
        role: 'assistant',
        answer: data.answer,
        sql: data.sql,
        rows: data.rows,
        rowCount: data.rowCount,
        error: data.error,
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch {
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', error: 'Network error — check the console.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function toggleSQL(i: number) {
    setExpandedSQL((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function toggleRows(i: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const columns = (rows: Record<string, unknown>[]) =>
    rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <span className="text-lg font-semibold tracking-tight text-white">10K</span>
        <span className="text-gray-500 text-sm">Pipeline intelligence · read-only</span>
      </header>

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full">
        {turns.length === 0 && (
          <div className="mt-8">
            <p className="text-gray-400 text-sm mb-4">Try asking:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="text-left text-sm px-4 py-3 rounded-lg border border-gray-700 hover:border-gray-500 hover:bg-gray-800 transition-colors text-gray-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="mb-6">
            {turn.role === 'user' && (
              <div className="flex justify-end mb-2">
                <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-xl text-sm">
                  {turn.question}
                </div>
              </div>
            )}

            {turn.role === 'assistant' && (
              <div className="space-y-2">
                {turn.error && (
                  <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
                    {turn.error}
                  </div>
                )}

                {turn.answer && (
                  <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm leading-relaxed text-gray-100 max-w-2xl">
                    {turn.answer}
                  </div>
                )}

                {turn.sql && (
                  <div>
                    <button
                      onClick={() => toggleSQL(i)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {expandedSQL.has(i) ? '▾ Hide SQL' : '▸ Show SQL'}
                    </button>
                    {expandedSQL.has(i) && (
                      <pre className="mt-2 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap">
                        {turn.sql}
                      </pre>
                    )}
                  </div>
                )}

                {turn.rows && turn.rows.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleRows(i)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {expandedRows.has(i)
                        ? `▾ Hide rows (${turn.rowCount})`
                        : `▸ Show rows (${turn.rowCount})`}
                    </button>
                    {expandedRows.has(i) && (
                      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-700">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="bg-gray-800 text-gray-400">
                              {columns(turn.rows).map((col) => (
                                <th
                                  key={col}
                                  className="px-3 py-2 text-left font-medium whitespace-nowrap"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {turn.rows.map((row, ri) => (
                              <tr
                                key={ri}
                                className="border-t border-gray-800 hover:bg-gray-800/50"
                              >
                                {columns(turn.rows!).map((col) => (
                                  <td
                                    key={col}
                                    className="px-3 py-1.5 text-gray-300 whitespace-nowrap max-w-xs truncate"
                                  >
                                    {row[col] === null
                                      ? '—'
                                      : String(row[col])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {turn.rows && turn.rows.length === 0 && !turn.error && (
                  <p className="text-xs text-gray-500">No rows returned.</p>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="animate-pulse">●</span> Thinking…
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <div className="border-t border-gray-800 px-4 py-4 bg-gray-950">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="Ask a pipeline question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && ask(input)}
            disabled={loading}
          />
          <button
            onClick={() => ask(input)}
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
PAGE

echo "  ✓ ${APP}/agent/page.tsx"

# ─────────────────────────────────────────────
# 7. scripts/agent-readonly-role.sql
# ─────────────────────────────────────────────
mkdir -p scripts

cat > scripts/agent-readonly-role.sql << 'SQL'
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
SQL

echo "  ✓ scripts/agent-readonly-role.sql"

# ─────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
echo " 10K files written. Manual steps below:"
echo "════════════════════════════════════════════"
echo ""
echo "1. CREATE THE READ-ONLY DB ROLE"
echo "   a. Open scripts/agent-readonly-role.sql"
echo "   b. Replace 'CHOOSE_A_STRONG_PASSWORD' with a real password"
echo "   c. Run it in the Supabase SQL Editor"
echo "   d. Build AGENT_DATABASE_URL:"
echo "      postgresql://agent_readonly:<PASSWORD>@<HOST>:5432/postgres?sslmode=require"
echo "      (find HOST in Supabase → Settings → Database → Connection string)"
echo ""
echo "2. SET ENV VARS (locally and on Vercel)"
echo ""
echo "   Locally — add to .env.local:"
echo "   ANTHROPIC_API_KEY=sk-ant-..."
echo "   AGENT_DATABASE_URL=postgresql://agent_readonly:..."
echo "   AGENT_MODEL=claude-sonnet-4-20250514   # optional, this is the default"
echo ""
echo "   On Vercel (run these three commands, one at a time):"
echo "   echo 'sk-ant-YOUR_KEY' | npx vercel env add ANTHROPIC_API_KEY production"
echo "   echo 'postgresql://agent_readonly:...' | npx vercel env add AGENT_DATABASE_URL production"
echo "   echo 'claude-sonnet-4-20250514' | npx vercel env add AGENT_MODEL production"
echo "   npx vercel --prod --force"
echo ""
echo "3. ADD NAV LINK"
echo "   In your existing nav component, add:"
echo "   <Link href='/agent'>10K</Link>"
echo ""
echo "4. VERIFY the read-only role can see all four tables before trusting"
echo "   an empty result. Connect as agent_readonly and run:"
echo "   SELECT COUNT(*) FROM deals;"
echo "   (should return your deal count, not an error)"
echo ""

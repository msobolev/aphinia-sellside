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

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

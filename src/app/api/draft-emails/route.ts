// src/app/api/draft-emails/route.ts
//
// Creates Gmail drafts via the Gmail API using an OAuth2 refresh token.
// Env vars required (set in .env.local AND in Vercel):
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
//
// Response shape is unchanged: { results, successCount, totalCount }
// so the dispatch page and the event nudge picker both keep working.

import { NextRequest, NextResponse } from 'next/server';

interface DraftRequest {
  drafts: { to: string; subject: string; body: string }[];
}

const FROM_EMAIL = 'misha.sobolev@aphinia.com';

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// RFC 2047 encode a header only if it contains non-ASCII characters.
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function buildRaw(to: string, subject: string, body: string): string {
  return [
    `From: ${FROM_EMAIL}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ].join('\r\n');
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID || '',
      client_secret: process.env.GMAIL_CLIENT_SECRET || '',
      refresh_token: process.env.GMAIL_REFRESH_TOKEN || '',
      grant_type: 'refresh_token',
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to refresh access token');
  }
  return data.access_token as string;
}

export async function POST(req: NextRequest) {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
    return NextResponse.json(
      { error: 'Gmail not configured — set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN' },
      { status: 500 },
    );
  }

  const { drafts } = (await req.json()) as DraftRequest;
  if (!drafts || drafts.length === 0) {
    return NextResponse.json({ error: 'No drafts provided' }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gmail auth failed' },
      { status: 500 },
    );
  }

  const results: { to: string; success: boolean; error?: string }[] = [];

  for (const draft of drafts) {
    try {
      const raw = b64url(buildRaw(draft.to, draft.subject, draft.body));
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: { raw } }),
      });
      if (!res.ok) {
        const errText = await res.text();
        results.push({ to: draft.to, success: false, error: `Gmail ${res.status}: ${errText.slice(0, 300)}` });
        continue;
      }
      results.push({ to: draft.to, success: true });
    } catch (err: unknown) {
      results.push({ to: draft.to, success: false, error: err instanceof Error ? err.message.slice(0, 300) : 'error' });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return NextResponse.json({ results, successCount, totalCount: drafts.length });
}

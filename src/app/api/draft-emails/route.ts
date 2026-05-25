// src/app/api/draft-emails/route.ts

import { NextRequest, NextResponse } from 'next/server';

interface DraftRequest {
  drafts: {
    to: string;
    subject: string;
    body: string;
  }[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const { drafts } = (await req.json()) as DraftRequest;
  if (!drafts || drafts.length === 0) {
    return NextResponse.json({ error: 'No drafts provided' }, { status: 400 });
  }

  const results: { to: string; success: boolean; error?: string }[] = [];

  for (const draft of drafts) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: 'You are an email drafting assistant. Create a Gmail draft using the provided details exactly as given. Do not modify the subject or body. Call the create_draft tool immediately.',
          messages: [
            {
              role: 'user',
              content: `Create a Gmail draft:\n\nTo: ${draft.to}\nSubject: ${draft.subject}\n\nBody:\n${draft.body}`,
            },
          ],
          mcp_servers: [
            {
              type: 'url',
              url: 'https://gmailmcp.googleapis.com/mcp/v1',
              name: 'gmail',
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        results.push({ to: draft.to, success: false, error: `API ${response.status}: ${errText.slice(0, 300)}` });
        continue;
      }

      const data = await response.json();
      const toolResults = data.content?.filter((b: any) => b.type === 'mcp_tool_result') || [];
      const textBlocks = data.content?.filter((b: any) => b.type === 'text') || [];
      const hasError = textBlocks.some((b: any) => b.text?.toLowerCase().includes('error'));

      if (toolResults.length > 0 && !hasError) {
        results.push({ to: draft.to, success: true });
      } else {
        const msg = textBlocks.map((b: any) => b.text).join(' ').slice(0, 300);
        results.push({ to: draft.to, success: false, error: msg || 'No tool result returned' });
      }
    } catch (err: any) {
      results.push({ to: draft.to, success: false, error: err.message?.slice(0, 300) });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return NextResponse.json({ results, successCount, totalCount: drafts.length });
}

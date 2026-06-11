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

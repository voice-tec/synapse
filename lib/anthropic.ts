// Helper condiviso per le chiamate all'API Anthropic.
// Gestisce il loop pause_turn (web_search è un tool server-side: l'API lo
// esegue da sola; se il suo loop interno si interrompe, stop_reason è
// 'pause_turn' e si riprende riaccodando il turno assistant, senza tool_result).

const API_URL = 'https://api.anthropic.com/v1/messages';
const BATCH_URL = 'https://api.anthropic.com/v1/messages/batches';

const apiHeaders = () => ({
  'Content-Type': 'application/json',
  'x-api-key': process.env.ANTHROPIC_API_KEY!,
  'anthropic-version': '2023-06-01',
});

export function extractJSON(text: string) {
  if (!text) throw new Error('Risposta vuota dal modello');
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) {
    try { return JSON.parse(t.slice(s, e + 1)); } catch (err) {}
  }
  // Recovery for truncated JSON (model hit max_tokens): close open brackets/strings
  if (s !== -1) {
    let frag = t.slice(s);
    try {
      frag = frag.replace(/,\s*"[^"]*$/, '').replace(/:\s*"[^"]*$/, ':null').replace(/,\s*$/, '');
      const opens = (frag.match(/\{/g) || []).length, closes = (frag.match(/\}/g) || []).length;
      const opensA = (frag.match(/\[/g) || []).length, closesA = (frag.match(/\]/g) || []).length;
      frag += ']'.repeat(Math.max(0, opensA - closesA));
      frag += '}'.repeat(Math.max(0, opens - closes));
      return JSON.parse(frag);
    } catch (err) {}
  }
  throw new Error('JSON non parsabile: ' + t.slice(0, 120));
}

export async function askClaudeJSON(opts: {
  model: string;
  system: string | any[];
  user: string;
  maxTokens: number;
  tools?: any[];
}) {
  const messages: any[] = [{ role: 'user', content: opts.user }];

  const call = async () => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: typeof opts.system === 'string' ? [{ type: 'text', text: opts.system }] : opts.system,
        ...(opts.tools ? { tools: opts.tools, tool_choice: { type: 'auto' } } : {}),
        messages,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  };

  let data = await call();
  let continuations = 0;
  while (data.stop_reason === 'pause_turn' && continuations < 3) {
    messages.push({ role: 'assistant', content: data.content });
    data = await call();
    continuations++;
  }

  const finalText = data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  return extractJSON(finalText);
}

// ── Message Batches API — -50% sul prezzo dei token, per lavori non urgenti ──

export async function createBatch(requests: { custom_id: string; params: any }[]) {
  const res = await fetch(BATCH_URL, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ requests }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data; // { id, processing_status, ... }
}

export async function getBatch(batchId: string) {
  const res = await fetch(`${BATCH_URL}/${batchId}`, { headers: apiHeaders() });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

// Risultati in JSONL: una riga per richiesta, { custom_id, result: { type, message } }
export async function getBatchResults(resultsUrl: string) {
  const res = await fetch(resultsUrl, { headers: apiHeaders() });
  const text = await res.text();
  return text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

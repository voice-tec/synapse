import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

function extractJSON(text){
  if(!text) throw new Error('Risposta vuota dal modello');
  let t = text.replace(/```json|```/g, '').trim();
  // Find first { and last } to isolate JSON object
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if(start !== -1 && end !== -1 && end > start){ t = t.slice(start, end+1); }
  return JSON.parse(t);
}


const SYS = `Sei il motore di Synapse, una piattaforma di financial intelligence.
Analizza questa task e il suo contesto nel grafo semantico dell'utente.
Suggerisci 3 domande specifiche che completerebbero o approfondirebbero questa analisi, colmando gap evidenti.
Le domande devono essere diverse da quelle gia' nel grafo, concrete, in italiano.
Rispondi SOLO con JSON valido:
{"questions":[{"q":"domanda 1","reason":"perché colma un gap in una frase corta"},{"q":"domanda 2","reason":"..."},{"q":"domanda 3","reason":"..."}]}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { userMsg } = await req.json();

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: [{ type: 'text', text: SYS, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const rawText = (data.content || []).filter((b)=>b.type==='text').map((b)=>b.text).join('');
    const parsed = extractJSON(rawText);
    return NextResponse.json({ result: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, detail: String(err) }, { status: 500 });
  }
}

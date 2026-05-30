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


const SYS = `Sei il motore di analisi di Synapse. Analizza queste task finanziarie e identifica i CLUSTER SEMANTICI DISTINTI — gruppi di domande che esplorano tesi diverse.
Per ogni cluster con confidenza >= 65, genera una tesi emergente.
Rispondi SOLO con JSON valido:
{
  "clusters": [
    {
      "id": "stringa identificativa breve del cluster",
      "confidence": numero 0-100,
      "thesis": "la tesi emergente in UNA frase italiana concisa",
      "explanation": "2 frasi su perché questa tesi emerge",
      "pattern": "descrivi il pattern analitico del cluster",
      "source_indices": [indici 1-based, massimo 6],
      "suggested_question": "una domanda che completerebbe questa tesi"
    }
  ]
}
Se non ci sono cluster con confidenza >= 65, rispondi {"clusters":[]}. Massimo 4 cluster.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { summary, taskCount } = await req.json();

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
        max_tokens: 800,
        system: [{ type: 'text', text: SYS, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Analizza queste ${taskCount} task:\n${summary}` }],
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

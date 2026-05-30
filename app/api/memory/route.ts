import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: [{ type: 'text', text: SYS, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Analizza queste ${taskCount} task:\n${summary}` }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const parsed = JSON.parse((data.content?.[0]?.text || '').replace(/```json|```/g, '').trim());
    return NextResponse.json({ result: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

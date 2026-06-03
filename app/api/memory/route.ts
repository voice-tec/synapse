import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

function extractJSON(text){
  if(!text) throw new Error('Risposta vuota dal modello');
  let t = text.replace(/```json/gi,'').replace(/```/g,'').trim();
  try { return JSON.parse(t); } catch(e){}
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if(s!==-1 && e!==-1 && e>s){
    try { return JSON.parse(t.slice(s, e+1)); } catch(err){}
  }
  if(s!==-1){
    let frag = t.slice(s);
    try {
      frag = frag.replace(/,\s*"[^"]*$/,'').replace(/:\s*"[^"]*$/,':null').replace(/,\s*$/,'');
      const opens=(frag.match(/\{/g)||[]).length, closes=(frag.match(/\}/g)||[]).length;
      const opensA=(frag.match(/\[/g)||[]).length, closesA=(frag.match(/\]/g)||[]).length;
      frag += ']'.repeat(Math.max(0,opensA-closesA));
      frag += '}'.repeat(Math.max(0,opens-closes));
      return JSON.parse(frag);
    } catch(err){}
  }
  throw new Error('JSON non parsabile: ' + t.slice(0,120));
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
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: [{ type: 'text', text: SYS }],
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

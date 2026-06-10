import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { askClaudeJSON } from '@/lib/anthropic';
import { checkAiCall, bumpAiCall } from '@/lib/ai-usage';

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

  const gate = await checkAiCall(supabase, user.id);
  if (!gate.allowed) {
    return NextResponse.json({ error: 'limit_reached', plan: gate.plan, limit: gate.limit }, { status: 429 });
  }

  const { summary, taskCount } = await req.json();

  try {
    const parsed = await askClaudeJSON({
      model: 'claude-haiku-4-5', // clustering semplice: Haiku basta, ~10x più economico
      system: SYS,
      user: `Analizza queste ${taskCount} task:\n${summary}`,
      maxTokens: 2000,
    });
    await bumpAiCall(supabase, user.id, gate.used);
    return NextResponse.json({ result: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, detail: String(err) }, { status: 500 });
  }
}

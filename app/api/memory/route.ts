import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { askClaudeJSON } from '@/lib/anthropic';
import { checkAiCall, bumpAiCall } from '@/lib/ai-usage';

const SYS = `Sei il motore di analisi di Synapse. Ti vengono date: (1) le TESI GIÀ ESISTENTI dell'utente, (2) le sue task finanziarie.
Analizza le task e identifica i CLUSTER SEMANTICI DISTINTI — gruppi di domande che esplorano tesi diverse.

Per ogni cluster decidi l'azione:
- "update": il cluster corrisponde a una tesi esistente (anche se riformulata o vista da un'angolazione diversa) → metti il suo id in existing_id. La tesi può evolvere: riformula pure il testo.
- "new": il cluster esprime una tesi GENUINAMENTE DISTINTA da tutte le esistenti.

REGOLE DURE:
- In dubbio tra update e new → SEMPRE update. Tesi semi-sovrapposte sono un errore grave.
- "new" richiede confidence >= 70 E almeno 3 task sorgente.
- Se le tesi esistenti sono già 6 o più, NON creare "new": solo update.

Rispondi SOLO con JSON valido:
{
  "clusters": [
    {
      "action": "update" | "new",
      "existing_id": "id della tesi esistente se update, altrimenti null",
      "id": "stringa identificativa breve del cluster",
      "confidence": numero 0-100,
      "thesis": "la tesi in UNA frase italiana concisa",
      "explanation": "2 frasi su perché questa tesi emerge",
      "pattern": "descrivi il pattern analitico del cluster",
      "source_indices": [indici 1-based, massimo 6],
      "suggested_question": "una domanda che completerebbe questa tesi",
      "signals": {
        "confirm": ["2 segnali OSSERVABILI e concreti che rafforzerebbero la tesi (dati, eventi, soglie)"],
        "invalidate": ["2 segnali OSSERVABILI e concreti che la indebolirebbero"]
      }
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

  const { summary, taskCount, theses } = await req.json();

  const thesesBlock = (theses || []).length
    ? `TESI ESISTENTI:\n${theses.map((t: any) => `- [${t.id}] "${t.thesis}" (confidenza ${t.confidence})`).join('\n')}`
    : 'TESI ESISTENTI: nessuna';

  try {
    const parsed = await askClaudeJSON({
      model: 'claude-haiku-4-5', // clustering semplice: Haiku basta, ~10x più economico
      system: SYS,
      user: `${thesesBlock}\n\nAnalizza queste ${taskCount} task:\n${summary}`,
      maxTokens: 2000,
    });
    await bumpAiCall(supabase, user.id, gate.used);
    return NextResponse.json({ result: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, detail: String(err) }, { status: 500 });
  }
}

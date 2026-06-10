import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { askClaudeJSON } from '@/lib/anthropic';
import { checkAiCall, bumpAiCall } from '@/lib/ai-usage';

const SYS = `Sei l'avvocato del diavolo di Synapse, una piattaforma di financial intelligence.
Data una tesi di investimento dell'utente, costruisci il MIGLIOR CASO CONTRARIO possibile, con dati concreti.
Usa web_search se servono dati recenti per argomentare il caso contrario.

IMPORTANTE — INQUADRAMENTO EDUCATIVO:
- Sei uno strumento educativo che allena il pensiero critico, NON un consulente finanziario.
- Argomenta con fatti e meccanismi economici, non con opinioni generiche.

Rispondi SOLO con JSON valido, nessun testo extra:
{
  "counter_thesis": "la contro-tesi in UNA frase italiana incisiva",
  "arguments": [
    {"point": "argomento contrario conciso", "evidence": "dato o meccanismo concreto che lo sostiene, una frase"}
  ],
  "weak_spots": ["punto debole specifico della tesi originale, una frase"],
  "what_would_confirm": "quale evidenza futura darebbe invece ragione alla tesi originale, una frase"
}
Massimo 3 arguments, massimo 2 weak_spots.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const gate = await checkAiCall(supabase, user.id);
  if (!gate.allowed) {
    return NextResponse.json({ error: 'limit_reached', plan: gate.plan, limit: gate.limit }, { status: 429 });
  }

  const { thesis, explanation, clusterId } = await req.json();
  if (!thesis) return NextResponse.json({ error: 'Tesi mancante' }, { status: 400 });

  try {
    const parsed = await askClaudeJSON({
      model: 'claude-sonnet-4-6',
      system: SYS,
      user: `Tesi: "${thesis}"\nContesto: "${explanation || ''}"\n\nCostruisci il caso contrario.`,
      maxTokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
    });

    const challenge = { ...parsed, date: new Date().toISOString() };

    // Persiste sulla tesi, così sopravvive ai reload
    if (clusterId) {
      await supabase
        .from('theses')
        .update({ challenge })
        .eq('user_id', user.id)
        .eq('cluster_id', clusterId);
    }

    await bumpAiCall(supabase, user.id, gate.used);
    return NextResponse.json({ result: challenge });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

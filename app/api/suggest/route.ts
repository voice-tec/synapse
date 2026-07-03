import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { askClaudeJSON } from '@/lib/anthropic';
import { normLang, withLang } from '@/lib/lang';
import { checkAiCall, bumpAiCall } from '@/lib/ai-usage';

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

  const gate = await checkAiCall(supabase, user.id);
  if (!gate.allowed) {
    return NextResponse.json({ error: 'limit_reached', plan: gate.plan, limit: gate.limit }, { status: 429 });
  }

  const { userMsg, lang: rawLang } = await req.json();
  const lang = normLang(rawLang);

  try {
    const { json: parsed } = await askClaudeJSON({
      model: 'claude-haiku-4-5',
      system: withLang(SYS, lang),
      user: userMsg,
      maxTokens: 1024,
    });
    await bumpAiCall(supabase, user.id, gate.used);
    return NextResponse.json({ result: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, detail: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { askClaudeJSON } from '@/lib/anthropic';
import { normLang, withLang } from '@/lib/lang';
import { checkAiCall, bumpAiCall } from '@/lib/ai-usage';

// Seed del grafo al primo accesso: dal portafoglio reale dell'utente propone
// poche domande di investimento concrete sui titoli posseduti, così il grafo
// non parte vuoto. Solo proposte (Haiku, economico): l'analisi vera parte solo
// quando l'utente clicca.
const SYS = `Sei il motore di Synapse, una piattaforma di financial intelligence.
Ti viene dato il PORTAFOGLIO REALE dell'utente (strumenti + peso %).
Proponi 3 domande di investimento CONCRETE e SPECIFICHE sui titoli/temi che possiede e che vale la pena indagare ora (rischi, esposizioni, scenari macro che li toccano). Diverse tra loro, in italiano, una frase ciascuna.
Rispondi SOLO con JSON valido:
{"questions":[{"q":"domanda 1","reason":"perché conta per il suo portafoglio, una frase"},{"q":"domanda 2","reason":"..."},{"q":"domanda 3","reason":"..."}]}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const lang = normLang((await req.json().catch(() => ({} as any)))?.lang);
  const { data: profile } = await supabase.from('profiles').select('portfolio').eq('id', user.id).single();
  const holdings: any[] = Array.isArray(profile?.portfolio) ? profile!.portfolio : [];
  if (!holdings.length) return NextResponse.json({ result: { questions: [] } });

  const gate = await checkAiCall(supabase, user.id);
  if (!gate.allowed) {
    return NextResponse.json({ error: 'limit_reached', plan: gate.plan, limit: gate.limit }, { status: 429 });
  }

  const list = holdings
    .map((h) => `- ${h.ticker || h.name || '?'}${h.weight != null ? ` (${h.weight}%)` : ''}`)
    .join('\n');

  try {
    const { json: parsed } = await askClaudeJSON({
      model: 'claude-haiku-4-5',
      system: withLang(SYS, lang),
      user: `PORTAFOGLIO:\n${list}`,
      maxTokens: 1024,
    });
    await bumpAiCall(supabase, user.id, gate.used);
    return NextResponse.json({ result: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, detail: String(err) }, { status: 500 });
  }
}

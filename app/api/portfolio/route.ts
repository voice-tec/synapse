import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { askClaudeJSON } from '@/lib/anthropic';
import { checkAiCall, bumpAiCall } from '@/lib/ai-usage';

const SYS = `Sei il motore di Synapse, una piattaforma di financial intelligence.
Data una tesi di investimento dell'utente, mappa la tesi alle CATEGORIE DI ASSET che storicamente la incarnano, con esempi concreti di strumenti dentro ogni categoria.

IMPORTANTE — INQUADRAMENTO EDUCATIVO OBBLIGATORIO:
- NON dare raccomandazioni personalizzate ("compra X"). Presenta come "asset che storicamente incarnano questa tesi".
- Sei uno strumento educativo che mappa strategie a strumenti, NON un consulente finanziario.
- Includi sempre esempi reali e riconoscibili (ETF, indici, categorie), ma inquadrati come esempi illustrativi.

Usa web_search per trovare strumenti reali e aggiornati (ticker ETF, nomi corretti) quando utile.

Rispondi SOLO con JSON valido, nessun testo extra:
{
  "title": "nome breve del portafoglio della tesi in italiano",
  "summary": "1-2 frasi che spiegano la logica del portafoglio rispetto alla tesi",
  "categories": [
    {
      "name": "nome categoria (es: Metalli preziosi)",
      "rationale": "perché questa categoria serve la tesi, una frase",
      "weight_hint": "peso indicativo es '15-25%'",
      "examples": [
        {"name": "nome strumento (es: iShares Physical Gold)", "ticker": "ticker se esiste (es: SGLN)", "note": "nota brevissima"}
      ]
    }
  ],
  "caveat": "una frase che ricorda che è educativo e non consulenza"
}
Massimo 5 categorie, massimo 3 esempi per categoria.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const gate = await checkAiCall(supabase, user.id);
  if (!gate.allowed) {
    return NextResponse.json({ error: 'limit_reached', plan: gate.plan, limit: gate.limit }, { status: 429 });
  }

  const { thesis, pattern } = await req.json();

  try {
    const parsed = await askClaudeJSON({
      model: 'claude-sonnet-4-6',
      system: SYS,
      user: `Tesi: "${thesis}"\nPattern: "${pattern || ''}"\n\nGenera il portafoglio della tesi.`,
      maxTokens: 3000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
    });
    await bumpAiCall(supabase, user.id, gate.used);
    return NextResponse.json({ result: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

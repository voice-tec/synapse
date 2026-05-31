import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

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

  const { thesis, pattern } = await req.json();

  const systemPayload = [{ type: 'text', text: SYS, cache_control: { type: 'ephemeral' } }];

  try {
    let res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPayload,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        tool_choice: { type: 'auto' },
        messages: [{ role: 'user', content: `Tesi: "${thesis}"\nPattern: "${pattern || ''}"\n\nGenera il portafoglio della tesi.` }],
      }),
    });

    let data = await res.json();
    if (data.error) throw new Error(data.error.message);

    let finalText = '';
    if (data.stop_reason === 'tool_use') {
      const messages: any[] = [
        { role: 'user', content: `Tesi: "${thesis}"\nPattern: "${pattern || ''}"\n\nGenera il portafoglio della tesi.` },
        { role: 'assistant', content: data.content },
      ];
      const toolResults = data.content
        .filter((b: any) => b.type === 'tool_use')
        .map((b: any) => ({ type: 'tool_result', tool_use_id: b.id, content: b.input?.query || '' }));
      if (toolResults.length) {
        messages.push({ role: 'user', content: toolResults });
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'prompt-caching-2024-07-31',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            system: systemPayload,
            tools: [{ type: 'web_search_20250305', name: 'web_search' }],
            messages,
          }),
        });
        data = await res.json();
        if (data.error) throw new Error(data.error.message);
      }
      finalText = data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    } else {
      finalText = data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    }

    const parsed = JSON.parse(finalText.replace(/```json|```/g, '').trim());
    return NextResponse.json({ result: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

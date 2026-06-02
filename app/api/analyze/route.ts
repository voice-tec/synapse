import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

function extractJSON(text: string){
  if(!text) throw new Error('Risposta vuota dal modello');
  let t = text.replace(/```json/gi,'').replace(/```/g,'').trim();
  try { return JSON.parse(t); } catch(e){}
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if(s!==-1 && e!==-1 && e>s){
    try { return JSON.parse(t.slice(s, e+1)); } catch(err){}
  }
  // Recovery for truncated JSON (model hit max_tokens): close open brackets/strings
  if(s!==-1){
    let frag = t.slice(s);
    // If ends mid-string, drop to last complete value
    try {
      // Remove trailing incomplete token after last comma or colon
      frag = frag.replace(/,\s*"[^"]*$/,'').replace(/:\s*"[^"]*$/,':null').replace(/,\s*$/,'');
      // Count and close open braces/brackets
      const opens = (frag.match(/\{/g)||[]).length, closes = (frag.match(/\}/g)||[]).length;
      const opensA = (frag.match(/\[/g)||[]).length, closesA = (frag.match(/\]/g)||[]).length;
      frag += ']'.repeat(Math.max(0,opensA-closesA));
      frag += '}'.repeat(Math.max(0,opens-closes));
      return JSON.parse(frag);
    } catch(err){}
  }
  throw new Error('JSON non parsabile: ' + t.slice(0,120));
}

// Limiti per piano
const PLAN_LIMITS: Record<string, number> = {
  free: 10,    // 10 task al mese
  pro: 99999,  // illimitato di fatto
  team: 99999,
};

const SYSTEM_PROMPT = `You are the analysis engine of Synapse, a financial intelligence platform.

You have access to web_search. Use it ONLY when the question requires current or recent data that you cannot answer accurately from training (e.g. current prices, recent performance, latest macro data, recent news). Do NOT search for conceptual or historical questions you already know well.

Return ONLY a valid JSON object, no extra text, no markdown.

{
  "intent":{
    "assets":["assets/sectors/indices"],
    "metrics":["relevant metrics"],
    "timeframe":"period or 'non specificato'",
    "analysis_type":"causal|compare|risk|trend|screen"
  },
  "fingerprint":{
    "concepts":["2-4 key financial concepts"],
    "hypothesis":"implicit thesis in ONE sentence in Italian",
    "sector":"main sector",
    "macro_regime":"relevant macro context"
  },
  "output":{
    "insight":"3-4 sentence analysis in Italian, concrete and data-grounded",
    "chart":{
      "label":"chart title in Italian (clear, what the chart shows)",
      "type":"bar for comparisons between categories/sectors/assets; line only for evolution over time",
      "values":[4-7 realistic numbers based on real data],
      "labels":["ONE or TWO words each, max 10 chars, e.g. 'Oro','Azioni','Bond brevi' — never long phrases"],
      "suffix":"optional unit shown on values, e.g. '%' or 'bps' or '' if none"
    },
    "metrics":[
      {"k":"label","v":"value with unit","pos":true}
    ],
    "sources":["only if web search was used"]
  }
}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  // Controlla piano e utilizzo del mese
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, tasks_this_month')
    .eq('id', user.id)
    .single();

  const plan = profile?.plan || 'free';
  const used = profile?.tasks_this_month || 0;
  const limit = PLAN_LIMITS[plan];

  if (used >= limit) {
    return NextResponse.json(
      { error: 'limit_reached', plan, limit },
      { status: 429 }
    );
  }

  const { query, priorContext } = await req.json();

  const systemPayload = priorContext
    ? [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: priorContext, cache_control: { type: 'ephemeral' } },
      ]
    : [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }];

  try {
    // Prima chiamata — web search disponibile, Claude decide
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
        max_tokens: 4000,
        system: systemPayload,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        tool_choice: { type: 'auto' },
        messages: [{ role: 'user', content: query }],
      }),
    });

    let data = await res.json();
    if (data.error) throw new Error(data.error.message);

    let finalText = '';

    // Loop tool_use se Claude ha cercato
    if (data.stop_reason === 'tool_use') {
      const messages = [
        { role: 'user', content: query },
        { role: 'assistant', content: data.content },
      ];
      const toolResults = data.content
        .filter((b: any) => b.type === 'tool_use')
        .map((b: any) => ({
          type: 'tool_result',
          tool_use_id: b.id,
          content: b.input?.query || '',
        }));
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
            max_tokens: 4000,
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

    const parsed = extractJSON(finalText);

    // Incrementa contatore utilizzo
    await supabase
      .from('profiles')
      .update({ tasks_this_month: used + 1 })
      .eq('id', user.id);

    return NextResponse.json({ result: parsed, usage: { used: used + 1, limit, plan } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

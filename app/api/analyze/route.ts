import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { askClaudeJSON } from '@/lib/anthropic';

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

  // Quality stays as before: ALWAYS Sonnet + web search available.
  // The only cost control is capping web search to 1 use per question
  // (it used to fire 2-3 times and re-read huge page content — that was the
  // real cost driver, not the model). max_tokens trimmed to 3000 (real
  // answers were already under that, so no quality loss).
  const model = 'claude-sonnet-4-6';
  const webTools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }];
  const MAX_TOKENS = 3000;

  // No prompt caching: with intermittent beta usage the cache is rewritten
  // before it's reused, so the write surcharge costs more than it saves.
  const systemPayload = priorContext
    ? [
        { type: 'text', text: SYSTEM_PROMPT },
        { type: 'text', text: priorContext },
      ]
    : [{ type: 'text', text: SYSTEM_PROMPT }];

  try {
    const parsed = await askClaudeJSON({
      model,
      system: systemPayload,
      user: query,
      maxTokens: MAX_TOKENS,
      tools: webTools,
    });

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

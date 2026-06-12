import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { askClaudeJSON } from '@/lib/anthropic';
import { enrichChartWithRealData } from '@/lib/quotes';
import { macroSnapshot } from '@/lib/fred';

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
    "verdict":{
      "stance":"si|no|dipende. Verdict ONLY when the question implies a decision or judgment (è da comprare? conviene? meglio X o Y? è rischioso?) — whole verdict null for purely informative questions",
      "label":"the direct answer in ONE Italian sentence, max 12 words, no hedging — e.g. 'Non quotata: esposizione possibile solo tramite veicoli indiretti'",
      "confidence":"alta|media|bassa"
    },
    "takeaways":["2-3 key facts in Italian, max 14 words each — the numbers/facts that actually drive the conclusion. ALWAYS provided"],
    "chart":{
      "label":"chart title in Italian. MUST state exactly what is shown AND the period, e.g. 'Oro vs S&P 500, ultimi 6 mesi' — never vague titles like 'Confronto asset'",
      "type":"bar for comparisons between categories/sectors/assets; line only for evolution over time",
      "tickers":["up to 4 REAL traded tickers (ETFs/stocks/indices, e.g. GLD, SPY, ^GSPC). The server fetches REAL market data for them. RULES: pick tickers SPECIFIC to THIS question, not generic theme proxies; the chart must prove the main claim of YOUR insight; if a similar comparison already appears in the prior context, choose a DIFFERENT angle (other assets, other metric, other timeframe). Empty array [] if the concept is not directly quotable"],
      "fred":"ONE FRED series ID when the chart should show OFFICIAL US macro data instead of tickers (inflation, policy rates, treasury yields, unemployment, GDP, money supply, dollar, oil). Allowed values ONLY: CPIAUCSL, FEDFUNDS, DGS10, DGS2, T10Y2Y, UNRATE, GDPC1, M2SL, DTWEXBGS, DCOILWTICO. null otherwise. When set it takes precedence over tickers",
      "timeframe":"lookback window matching the question, one of: 1m|3m|6m|1y|5y",
      "values":[4-7 realistic numbers — ALWAYS provide them (also when tickers is set: they are the fallback if market data is unavailable)],
      "labels":["ONE or TWO words each, max 10 chars — ALWAYS provide, paired with values"],
      "suffix":"optional unit shown on values, e.g. '%' or 'bps' or '' if none"
    },
    "metrics":[
      {"k":"label","v":"value with unit","pos":true}
    ],
    "scenarios":[
      {"name":"bull|base|bear","prob":"approximate probability as 'NN%' — the three must sum to ~100","trigger":"the IF condition in Italian, max 10 words, e.g. 'Fed taglia due volte entro fine anno'","outcome":"expected effect in Italian, max 12 words"}
    ],
    "catalysts":[
      {"when":"upcoming date or period in Italian, short, e.g. '18 giu' or 'metà lug'","event":"event name in Italian, max 7 words, e.g. 'Riunione FOMC' or 'Trimestrale NVDA'","why":"why it matters for THIS question, max 10 words in Italian"}
    ],
    "portfolio_link":{"exposed":true,"note":"ONE Italian sentence quantifying the user's CURRENT exposure to the question's theme through their REAL holdings (look-through: e.g. a world ETF carries the index's tech share), citing instrument and approximate exposure with '~', e.g. 'Sei già esposto ~12% a questo tema via VWCE (quota tech dell'indice)'"}
  }
}

scenarios: EXACTLY 3 (bull, base, bear in this order) when the question implies a decision, outlook or risk judgment — the same cases that get a verdict. null for purely informative/historical questions.
catalysts: 2-4 UPCOMING events (central bank meetings, CPI/jobs releases, earnings, deadlines) relevant to the question, ordered by date, all AFTER today's date given below. Only events you are reasonably confident about; use period granularity ('metà lug') when unsure of the exact day. null when nothing relevant.
portfolio_link: ONLY when a USER REAL PORTFOLIO block is provided below AND the question meaningfully touches it. Estimate look-through exposure from the declared weights and the typical composition of each instrument; mark estimates with '~'. "exposed" false (with note explaining the gap) when the portfolio has NO meaningful exposure to the theme. null when no portfolio block or no meaningful relation. NEVER invent holdings not in the block.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  // Controlla piano e utilizzo del mese (+ portafoglio reale dichiarato)
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, tasks_this_month, portfolio')
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
  // 3600 (era 3000): scenari + catalizzatori + portfolio_link aggiungono
  // ~400 token di output; il recupero JSON troncato resta solo rete di sicurezza.
  const MAX_TOKENS = 3600;

  // Snapshot macro ufficiale (FRED) nel system: ~150 token che ancorano ogni
  // affermazione macro a numeri veri e risparmiano web_search inutili.
  const macro = await macroSnapshot();

  // Portafoglio REALE dichiarato dall'utente (profiles.portfolio): permette
  // al modello di dire "sei già esposto ~12% a questo tema via VWCE"
  // invece di una risposta generica.
  let portfolioCtx: string | null = null;
  const holdings: any[] = Array.isArray((profile as any)?.portfolio) ? (profile as any).portfolio : [];
  if (holdings.length) {
    const lines = holdings
      .filter((h) => h && (h.ticker || h.name))
      .slice(0, 20)
      .map((h) => `- ${h.ticker || ''}${h.name ? ` (${h.name})` : ''}: ${h.weight != null ? `${h.weight}%` : 'peso n/d'}`);
    if (lines.length) {
      portfolioCtx = `USER REAL PORTFOLIO (actual holdings the user declared, with portfolio weights):\n${lines.join('\n')}`;
    }
  }

  const today = `Today's date: ${new Date().toISOString().slice(0, 10)}. Catalysts must all be AFTER this date.`;

  // No prompt caching: with intermittent beta usage the cache is rewritten
  // before it's reused, so the write surcharge costs more than it saves.
  const systemPayload = [
    { type: 'text', text: SYSTEM_PROMPT },
    { type: 'text', text: today },
    ...(macro ? [{ type: 'text', text: macro }] : []),
    ...(portfolioCtx ? [{ type: 'text', text: portfolioCtx }] : []),
    ...(priorContext ? [{ type: 'text', text: priorContext }] : []),
  ];

  try {
    const { json: parsed, citations } = await askClaudeJSON({
      model,
      system: systemPayload,
      user: query,
      maxTokens: MAX_TOKENS,
      tools: webTools,
    });

    // Fonti: SOLO citazioni vere estratte dalla risposta API (web_search).
    // Quelle auto-dichiarate dal modello nel JSON vengono scartate: potevano
    // essere allucinate. Niente citazioni = niente fonti (badge "training").
    if (parsed?.output) {
      if (citations.length) {
        parsed.output.sources = citations.slice(0, 6);
      } else {
        delete parsed.output.sources;
      }
    }

    // Grafico con dati di mercato VERI quando il modello indica ticker;
    // altrimenti i valori stimati restano ma etichettati "stima".
    if (parsed?.output?.chart) {
      try {
        parsed.output.chart = await enrichChartWithRealData(parsed.output.chart);
      } catch (e) {
        // dati reali non disponibili: tieni la stima del modello
      }
    }

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

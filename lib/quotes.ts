// Prezzi di mercato via API Yahoo Finance non ufficiale — gratuita, senza chiave.
// Sostituisce la web search di Claude per il calcolo performance: costo zero.
// Best effort: se un ticker non si risolve o l'endpoint non risponde, torna null
// e lo strumento viene semplicemente omesso dal paniere.

const UA_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; SynapseApp/1.0)' };

// Yahoo vuole simboli con suffisso di borsa (es. SGLN → SGLN.L):
// l'endpoint di ricerca risolve il ticker "nudo" nel simbolo migliore.
async function resolveSymbol(ticker: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=1&newsCount=0`,
      { headers: UA_HEADERS }
    );
    const json = await res.json();
    return json.quotes?.[0]?.symbol || null;
  } catch {
    return null;
  }
}

// Performance % dal giorno `fromIso` a oggi (primo close vs ultimo close).
export async function fetchTickerPerformance(ticker: string, fromIso: string): Promise<number | null> {
  try {
    const symbol = await resolveSymbol(ticker);
    if (!symbol) return null;

    const p1 = Math.floor(new Date(fromIso).getTime() / 1000);
    const p2 = Math.floor(Date.now() / 1000);
    if (!p1 || p2 - p1 < 24 * 3600) return null; // serve almeno un giorno di storia

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`,
      { headers: UA_HEADERS }
    );
    const json = await res.json();
    const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter((c: any) => c != null);
    if (!closes || closes.length < 2) return null;

    return (closes[closes.length - 1] / closes[0] - 1) * 100;
  } catch {
    return null;
  }
}

export function formatPerf(pct: number): string {
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

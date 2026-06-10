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

// Serie storica giornaliera (date formattate it + close) per i grafici reali.
export async function fetchSeries(ticker: string, fromIso: string): Promise<{ dates: string[]; closes: number[] } | null> {
  try {
    const symbol = await resolveSymbol(ticker);
    if (!symbol) return null;

    const p1 = Math.floor(new Date(fromIso).getTime() / 1000);
    const p2 = Math.floor(Date.now() / 1000);
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`,
      { headers: UA_HEADERS }
    );
    const json = await res.json();
    const result = json.chart?.result?.[0];
    const ts: number[] = result?.timestamp || [];
    const raw: (number | null)[] = result?.indicators?.quote?.[0]?.close || [];
    const dates: string[] = [];
    const closes: number[] = [];
    ts.forEach((t, i) => {
      if (raw[i] != null) {
        dates.push(new Date(t * 1000).toLocaleDateString('it', { day: 'numeric', month: 'short' }));
        closes.push(raw[i] as number);
      }
    });
    return closes.length >= 2 ? { dates, closes } : null;
  } catch {
    return null;
  }
}

const TIMEFRAME_DAYS: Record<string, number> = { '1m': 30, '3m': 91, '6m': 182, '1y': 365, '5y': 1825 };

// Sostituisce i valori stimati dal modello con dati di mercato veri.
// - bar: performance % per ticker sul timeframe (confronto)
// - line: serie del primo ticker, ricampionata, in variazione % dal primo punto
// Se i ticker mancano o i dati non arrivano, tiene i valori del modello
// ma marca il grafico come stima — mai numeri inventati spacciati per veri.
export async function enrichChartWithRealData(chart: any) {
  if (!chart) return chart;
  const tickers: string[] = (chart.tickers || []).filter(Boolean).slice(0, 4);
  const days = TIMEFRAME_DAYS[chart.timeframe] || 182;
  const fromIso = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  if (tickers.length) {
    if (chart.type === 'line') {
      const s = await fetchSeries(tickers[0], fromIso);
      if (s) {
        const n = Math.min(12, s.closes.length);
        const idxs = Array.from({ length: n }, (_, i) => Math.round((i * (s.closes.length - 1)) / (n - 1)));
        const base = s.closes[idxs[0]];
        chart.values = idxs.map((i) => Number((((s.closes[i] / base) - 1) * 100).toFixed(1)));
        chart.labels = idxs.map((i) => s.dates[i]);
        chart.suffix = '%';
        chart.label = `${chart.label || ''} · ${tickers[0]}, dati reali`.trim();
        return chart;
      }
    } else {
      const results = await Promise.all(tickers.map((tk) => fetchTickerPerformance(tk, fromIso)));
      const items = tickers
        .map((tk, i) => ({ tk, pct: results[i] }))
        .filter((it): it is { tk: string; pct: number } => it.pct !== null);
      if (items.length >= 2) {
        chart.type = 'bar';
        chart.values = items.map((it) => Number(it.pct.toFixed(1)));
        chart.labels = items.map((it) => it.tk);
        chart.suffix = '%';
        chart.label = `${chart.label || ''} · dati reali ${chart.timeframe || ''}`.trim();
        return chart;
      }
    }
  }

  if (chart.label) chart.label += ' · stima';
  return chart;
}

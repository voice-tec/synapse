// Prezzi di mercato per grafici e performance — zero AI.
// Fonte primaria: Twelve Data (se TWELVEDATA_API_KEY è impostata — free tier
// 800 req/giorno, copertura ETF/borse EU molto migliore). Fallback: Yahoo
// Finance non ufficiale (gratuita, senza chiave, meno affidabile).
// Best effort: ticker non risolto o endpoint muto → null, lo strumento
// viene omesso senza rompere niente.

import { fredSeries } from './fred';

const UA_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; SynapseApp/1.0)' };
const TD_KEY = process.env.TWELVEDATA_API_KEY;

const itDate = (d: string | number) =>
  new Date(d).toLocaleDateString('it', { day: 'numeric', month: 'short' });

// ── Twelve Data ──
async function tdSeries(ticker: string, fromIso: string): Promise<{ dates: string[]; closes: number[] } | null> {
  if (!TD_KEY) return null;
  try {
    const sr = await fetch(
      `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(ticker)}&apikey=${TD_KEY}`
    );
    const sj = await sr.json();
    const hit = sj.data?.[0];
    if (!hit?.symbol) return null;

    const params =
      `symbol=${encodeURIComponent(hit.symbol)}` +
      (hit.mic_code ? `&mic_code=${hit.mic_code}` : '') +
      `&interval=1day&start_date=${fromIso.slice(0, 10)}&outputsize=5000&apikey=${TD_KEY}`;
    const r = await fetch(`https://api.twelvedata.com/time_series?${params}`);
    const j = await r.json();
    if (j.status === 'error' || !j.values?.length) return null;

    const dates: string[] = [];
    const closes: number[] = [];
    for (const v of [...j.values].reverse()) { // TD restituisce dal più recente
      const f = parseFloat(v.close);
      if (!isNaN(f)) { closes.push(f); dates.push(itDate(v.datetime)); }
    }
    return closes.length >= 2 ? { dates, closes } : null;
  } catch {
    return null;
  }
}

// ── Yahoo (fallback) ──
async function yahooResolve(ticker: string): Promise<string | null> {
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

async function yahooSeries(ticker: string, fromIso: string): Promise<{ dates: string[]; closes: number[] } | null> {
  try {
    const symbol = await yahooResolve(ticker);
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
      if (raw[i] != null) { dates.push(itDate(t * 1000)); closes.push(raw[i] as number); }
    });
    return closes.length >= 2 ? { dates, closes } : null;
  } catch {
    return null;
  }
}

// ── API pubblica ──
// Cache in-modulo (1h) per ridurre le chiamate ai provider (free tier Twelve
// Data: 800/giorno). Chiave = ticker+giorno-di-partenza; cacha anche i null
// così un ticker irrisolvibile non rimartella il provider per un'ora.
// Dedup le richieste identiche (stesso ticker e data) di portafogli e segnali.
const seriesCache = new Map<string, { at: number; data: { dates: string[]; closes: number[] } | null }>();
const SERIES_TTL = 60 * 60 * 1000;

export async function fetchSeries(ticker: string, fromIso: string) {
  if (!fromIso || Date.now() - new Date(fromIso).getTime() < 24 * 3600 * 1000) return null;
  const key = `${ticker.toUpperCase()}|${fromIso.slice(0, 10)}`;
  const c = seriesCache.get(key);
  if (c && Date.now() - c.at < SERIES_TTL) return c.data;
  const data = (await tdSeries(ticker, fromIso)) || (await yahooSeries(ticker, fromIso));
  seriesCache.set(key, { at: Date.now(), data });
  return data;
}

export async function fetchTickerPerformance(ticker: string, fromIso: string): Promise<number | null> {
  const s = await fetchSeries(ticker, fromIso);
  if (!s) return null;
  return (s.closes[s.closes.length - 1] / s.closes[0] - 1) * 100;
}

export function formatPerf(pct: number): string {
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
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

  // FRED ha precedenza sui ticker: per le domande macro la serie ufficiale
  // (CPI, tassi, disoccupazione...) è più autorevole di qualsiasi proxy ETF.
  const fredId: string | undefined = Array.isArray(chart.fred) ? chart.fred[0] : chart.fred;
  if (fredId) {
    const s = await fredSeries(fredId, fromIso);
    if (s) {
      const fmt: Intl.DateTimeFormatOptions =
        days > 365 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' };
      const n = Math.min(12, s.points.length);
      const idxs = Array.from({ length: n }, (_, i) => Math.round((i * (s.points.length - 1)) / (n - 1)));
      chart.type = 'line';
      chart.values = idxs.map((i) => Number(s.points[i].value.toFixed(2)));
      chart.labels = idxs.map((i) => new Date(s.points[i].date).toLocaleDateString('it', fmt));
      chart.suffix = s.meta.unit;
      chart.label = `${s.meta.label} · ${chart.timeframe || ''} · fonte FRED`.replace(' ·  ·', ' ·').trim();
      chart.asof = new Date().toISOString(); // freshness: dati reali, timestamp del fetch
      return chart;
    }
  }

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
        chart.label = `${chart.label || `Andamento ${tickers[0]}`} · ${tickers[0]} ${chart.timeframe || ''}, var. % reale`.trim();
        chart.asof = new Date().toISOString();
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
        chart.label = `${chart.label || 'Performance a confronto'} · perf. % reale ${chart.timeframe || ''}`.trim();
        chart.asof = new Date().toISOString();
        return chart;
      }
    }
  }

  // Niente dati reali: restano i valori stimati dal modello (sempre presenti
  // da prompt), etichettati onestamente come stima
  if ((chart.values || []).length) {
    chart.label = `${chart.label || 'Stima illustrativa'} · stima`;
  }
  return chart;
}

// Fondamentali via Financial Modeling Prep (free tier: ~250 req/giorno,
// SOLO trailing TTM — le stime forward restano segnali `manual`).
// Una chiamata a ratios-ttm torna DECINE di ratio per simbolo: la cache 24h
// memorizza l'intera riga, così un simbolo costa 1 richiesta al giorno
// qualunque sia il numero di segnali che lo usano.
// Filosofia identica a quotes/fred: senza FMP_API_KEY o su errore torna null,
// e il chiamante (evalSignals) marca il segnale data_missing — mai stale.

// Catalogo dei fondamentali misurabili nei segnali (kind:'fund', field:…).
// `keys`: nomi campo nella risposta FMP (stable per primo; v3 legacy come
// fallback per chiavi pre-2025 — per le nuove l'endpoint v3 risponde con un
// oggetto d'errore, che parseFundField ignora). `pct`: frazione → ×100,
// così le soglie si scrivono in % (naturale per l'LLM e per l'utente).
export const FUND_FIELDS: Record<string, { keys: string[]; pct?: boolean; label: string }> = {
  pe:           { keys: ['priceToEarningsRatioTTM', 'peRatioTTM'], label: 'P/E trailing' },
  ps:           { keys: ['priceToSalesRatioTTM'], label: 'Price/Sales' },
  pb:           { keys: ['priceToBookRatioTTM', 'priceBookValueRatioTTM'], label: 'Price/Book' },
  ev_ebitda:    { keys: ['enterpriseValueMultipleTTM'], label: 'EV/EBITDA' },
  peg:          { keys: ['priceToEarningsGrowthRatioTTM', 'pegRatioTTM'], label: 'PEG' },
  p_fcf:        { keys: ['priceToFreeCashFlowRatioTTM'], label: 'Price/FCF' },
  div_yield:    { keys: ['dividendYieldTTM', 'dividendYielTTM'], pct: true, label: 'dividend yield %' },
  net_margin:   { keys: ['netProfitMarginTTM'], pct: true, label: 'margine netto %' },
  gross_margin: { keys: ['grossProfitMarginTTM'], pct: true, label: 'margine lordo %' },
  de:           { keys: ['debtToEquityRatioTTM', 'debtEquityRatioTTM'], label: 'Debt/Equity' },
};

// Cache in-module 24h per simbolo (riga intera). Persiste finché l'istanza
// serverless resta calda (Fluid compute riusa le istanze). Anche i null vanno
// in cache: un simbolo non coperto non brucia il rate limit a ripetizione.
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { row: any | null; at: number }>();

// Estrae un field del catalogo da una riga ratios-ttm (primo nome candidato
// con valore numerico; frazioni → % quando pct).
export function parseFundField(payload: any, field: string): number | null {
  const spec = FUND_FIELDS[field];
  if (!spec) return null;
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== 'object') return null;
  for (const k of spec.keys) {
    const v = row[k];
    if (typeof v === 'number' && isFinite(v)) return spec.pct ? v * 100 : v;
  }
  return null;
}

type Fetcher = (url: string) => Promise<any | null>;
const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { next: { revalidate: 0 } } as any);
  if (!res.ok) return null;
  return res.json();
};

// Riga ratios-ttm di un simbolo (cache 24h), o null.
async function fetchRow(sym: string, fetcher: Fetcher): Promise<any | null> {
  const FMP_KEY = process.env.FMP_API_KEY || '';
  if (!FMP_KEY) return null;
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.row;
  let row: any | null = null;
  const pick = (payload: any) => {
    const r = Array.isArray(payload) ? payload[0] : null;
    return r && typeof r === 'object' ? r : null;
  };
  try {
    // Endpoint stable (chiavi nuove), poi fallback legacy v3 (chiavi pre-2025).
    row = pick(await fetcher(`https://financialmodelingprep.com/stable/ratios-ttm?symbol=${encodeURIComponent(sym)}&apikey=${FMP_KEY}`));
    if (row === null) {
      row = pick(await fetcher(`https://financialmodelingprep.com/api/v3/ratios-ttm/${encodeURIComponent(sym)}?apikey=${FMP_KEY}`));
    }
  } catch {
    row = null;
  }
  cache.set(sym, { row, at: Date.now() });
  return row;
}

// Fondamentale TTM di un titolo (field dal catalogo FUND_FIELDS), o null.
// `fetcher` iniettabile per i test (niente rete).
export async function fetchFundamental(
  symbol: string,
  field: string,
  fetcher: Fetcher = defaultFetcher,
): Promise<number | null> {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym || !FUND_FIELDS[field]) return null;
  const row = await fetchRow(sym, fetcher);
  return parseFundField(row ? [row] : null, field);
}

// Compat: firma originale del primo rilascio (kind 'pe').
export async function fetchPeTTM(
  symbol: string,
  fetcher: Fetcher = defaultFetcher,
): Promise<number | null> {
  return fetchFundamental(symbol, 'pe', fetcher);
}

// Solo per i test: svuota la cache tra un caso e l'altro.
export function __clearPeCache() { cache.clear(); }

// Fondamentali via Financial Modeling Prep (free tier: ~250 req/giorno,
// SOLO trailing TTM — il forward P/E resta un segnale `manual`).
// Filosofia identica a quotes/fred: senza FMP_API_KEY o su errore torna null,
// e il chiamante (evalSignals) marca il segnale data_missing — mai stale.

// Cache in-module 24h per simbolo: il P/E TTM cambia poco in un giorno e
// protegge il limite giornaliero del free tier. Persiste finché l'istanza
// serverless resta calda (Fluid compute riusa le istanze).
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { v: number | null; at: number }>();

// Estrae il P/E TTM da una risposta ratios-ttm: l'endpoint stable usa
// priceToEarningsRatioTTM, il legacy v3 usa peRatioTTM.
export function parsePeTTM(payload: any): number | null {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== 'object') return null;
  const v = row.priceToEarningsRatioTTM ?? row.peRatioTTM;
  return typeof v === 'number' && isFinite(v) ? v : null;
}

type Fetcher = (url: string) => Promise<any | null>;
const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { next: { revalidate: 0 } } as any);
  if (!res.ok) return null;
  return res.json();
};

// P/E trailing (TTM) di un titolo, o null se non disponibile.
// `fetcher` iniettabile per i test (niente rete).
export async function fetchPeTTM(
  symbol: string,
  fetcher: Fetcher = defaultFetcher,
): Promise<number | null> {
  const FMP_KEY = process.env.FMP_API_KEY || '';
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym || !FMP_KEY) return null;
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  let v: number | null = null;
  try {
    // Endpoint stable (chiavi nuove), poi fallback legacy v3 (chiavi vecchie).
    v = parsePeTTM(await fetcher(`https://financialmodelingprep.com/stable/ratios-ttm?symbol=${encodeURIComponent(sym)}&apikey=${FMP_KEY}`));
    if (v === null) {
      v = parsePeTTM(await fetcher(`https://financialmodelingprep.com/api/v3/ratios-ttm/${encodeURIComponent(sym)}?apikey=${FMP_KEY}`));
    }
  } catch {
    v = null;
  }
  // Anche i null vanno in cache: evita di bruciare il rate limit su simboli
  // che FMP non copre, ritentando comunque il giorno dopo.
  cache.set(sym, { v, at: Date.now() });
  return v;
}

// Solo per i test: svuota la cache tra un caso e l'altro.
export function __clearPeCache() { cache.clear(); }

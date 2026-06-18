// Validazione dei segnali GENERATI dal modello prima di salvarli: un segnale
// testabile con una metrica inesistente (id FRED fuori catalogo, ticker
// inventato) resterebbe per sempre "testabile ma mai scattato" e corromperebbe
// il track record. Qui i segnali non verificabili vengono declassati a `manual`
// (restano note qualitative, ma non contano come segnali testabili).

import { FRED_CATALOG } from '@/lib/fred';
import { resolveTicker } from '@/lib/quotes';

function demote(s: any) {
  s.kind = 'manual';
  s.metric = null;
  s.op = null;
  s.threshold = null;
}

// Best-effort: itera i segnali di tutti i cluster e declassa quelli non
// verificabili. `resolve` iniettabile per i test. Non lancia mai: la validazione
// è arricchimento di background, un errore non deve rompere la risposta.
export async function validateSignals(
  clusters: any[],
  resolve: (t: string) => Promise<boolean | null> = resolveTicker,
) {
  const all: any[] = [];
  for (const c of clusters || []) {
    for (const dir of ['confirm', 'invalidate'] as const) {
      for (const s of c?.signals?.[dir] || []) if (s) all.push(s);
    }
  }
  // FRED: check a costo zero contro il catalogo.
  for (const s of all) {
    if (s.kind === 'fred' && (!s.metric || !(s.metric in FRED_CATALOG))) demote(s);
  }
  // Ticker: risolvi i simboli unici una sola volta; declassa solo i `false`
  // definitivi (null = incerto → si tiene, per non punire errori transitori).
  const tickers = Array.from(new Set(
    all.filter((s) => s.kind === 'ticker' && s.metric).map((s) => String(s.metric)),
  ));
  const verdict = new Map<string, boolean | null>();
  await Promise.all(tickers.map(async (t) => {
    try { verdict.set(t, await resolve(t)); } catch { verdict.set(t, null); }
  }));
  for (const s of all) {
    if (s.kind === 'ticker' && verdict.get(String(s.metric)) === false) demote(s);
  }
}

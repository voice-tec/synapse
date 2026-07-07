// Estrae i ticker dai segnali strutturati di una tesi: i kind 'ticker', 'fund'
// e 'pe' (alias legacy) portano il simbolo in `metric`, già validato al
// salvataggio da lib/signals.ts (i simboli inventati vengono declassati a
// manual). Dedup, uppercase, ordine di apparizione. Funzione pura: usata dalla
// sezione "Per te" del marketplace (api/market/for-me).

const SYMBOL_KINDS = new Set(['ticker', 'fund', 'pe']);

export function extractTickers(signals: any): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const dir of ['confirm', 'invalidate'] as const) {
    for (const s of signals?.[dir] || []) {
      if (!s || typeof s === 'string') continue;
      if (!SYMBOL_KINDS.has(s.kind) || !s.metric) continue;
      const sym = String(s.metric).toUpperCase().trim();
      if (sym && !seen.has(sym)) { seen.add(sym); out.push(sym); }
    }
  }
  return out;
}

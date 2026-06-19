// Similarità testuale leggera per il dedup delle tesi (stessa logica di
// thesisSimilar in public/synapse/graph.js, qui lato server e testabile).

function words(s: string): Set<string> {
  return new Set(
    (s || '')
      .toLowerCase()
      .replace(/[^a-zà-ù0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3), // tiene solo parole significative
  );
}

// Overlap relativo all'insieme più piccolo (Jaccard-like): 0..1.
// >= 0.55 ⇒ stessa tesi (riformulazioni con sinonimi possono sfuggire, ma per
// il dedup all'import va bene: l'import è intenzionale, meglio un falso-blocco
// raro che doppioni evidenti).
export function wordOverlap(a: string, b: string): number {
  const wa = words(a), wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  const common = Array.from(wa).filter((w) => wb.has(w)).length;
  return common / Math.min(wa.size, wb.size);
}

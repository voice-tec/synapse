// Scoring delle relazioni tesi↔tesi — mirror puro e testabile di
// computeMemEdges/memSignalEntities/normAsset in public/synapse/graph.js
// (tenere allineati: graph.js è vanilla statico e non può importare da qui).
import { wordOverlap } from '@/lib/text';

export type MemSignal =
  | string // segnali legacy: semplici stringhe, nessuna entità estraibile
  | { text?: string; kind?: string; metric?: string };

export type MemThesisLike = {
  thesis?: string | null;
  sector?: string | null;
  signals?: { confirm?: MemSignal[]; invalidate?: MemSignal[] } | null;
};

export type MemEdge = { score: number; type: 'same_hypothesis' | 'complementary_data' };

// Normalizza un asset/ticker: "$nvda " e "NVDA" matchano exact; forme composte
// tipo "NVDA (Nvidia)" restano distinte (in graph.js le cattura il fuzzy).
export function normAsset(a: unknown): string {
  return String(a || '').toUpperCase().replace(/^\$/, '').replace(/[^A-Z0-9]/g, '');
}

// Entità testabili (ticker/FRED) citate nei segnali di una tesi.
export function signalEntities(t: MemThesisLike): string[] {
  const out: string[] = [];
  const sig = t.signals;
  if (!sig) return out;
  for (const side of ['confirm', 'invalidate'] as const) {
    for (const s of sig[side] || []) {
      if (!s || typeof s === 'string') continue;
      if ((s.kind === 'ticker' || s.kind === 'fred') && s.metric) {
        const n = normAsset(s.metric);
        if (n) out.push(n);
      }
    }
  }
  return out;
}

// Modello additivo, cap 1.0, soglia 0.4 (più alta dei task: pochi archi forti):
//   entità segnali condivise   prima +0.30, ogni altra +0.15, cap 0.50
//   overlap testo tesi         ratio≥0.5 → +0.35, ratio≥0.3 → +0.20
//   settore uguale (exact)     +0.10
// Ritorna null sotto soglia. Type: ambra (same_hypothesis) se domina il testo,
// blu (complementary_data) se dominano le entità. Niente contradiction: le tesi
// non hanno stance.
export function memEdgeScore(a: MemThesisLike, b: MemThesisLike): MemEdge | null {
  const ea = signalEntities(a), eb = signalEntities(b);
  const shared = Array.from(new Set(ea.filter((e) => eb.includes(e))));
  const entScore = shared.length ? Math.min(0.5, 0.30 + (shared.length - 1) * 0.15) : 0;
  const ratio = wordOverlap(a.thesis || '', b.thesis || '');
  const txtScore = ratio >= 0.5 ? 0.35 : ratio >= 0.3 ? 0.20 : 0;
  let score = entScore + txtScore;
  const s1 = (a.sector || '').toLowerCase().trim(), s2 = (b.sector || '').toLowerCase().trim();
  if (s1 && s2 && s1 === s2) score += 0.10;
  score = Math.round(Math.min(score, 1) * 100) / 100;
  if (score < 0.4) return null;
  return { score, type: txtScore > entScore ? 'same_hypothesis' : 'complementary_data' };
}

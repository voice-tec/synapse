// Confidence di una tesi = blend di dati REALI, non un numero sparato dall'LLM.
//  - verdictBase: dai verdetti delle task sorgente (si/no/dipende × alta/media/bassa)
//  - evalSignals: quanti segnali testabili (FRED / prezzo ticker) sono scattati oggi
//  - computeConfidence: base + scarto dei segnali, in [0,100]
// Funzioni pure (cmp/computeConfidence/normSig) isolate per essere testabili.

import { latestFredValue } from '@/lib/fred';
import { fetchTickerPerformance } from '@/lib/quotes';

export type SignalKind = 'fred' | 'ticker' | 'manual';

export type Signal = {
  text?: string;
  kind?: SignalKind | string;
  metric?: string | null;        // id FRED (es. CPIAUCSL) o simbolo ticker; null se manual
  op?: '<' | '>' | '<=' | '>=' | string | null;
  threshold?: number | null;
  // scritti dopo la valutazione:
  fired?: boolean;
  checked_at?: string;
};

export type Signals = { confirm?: any[]; invalidate?: any[] };

// Segnale legacy (stringa) → oggetto manual; passa gli oggetti invariati.
export function normSig(s: any): Signal {
  if (typeof s === 'string') return { text: s, kind: 'manual', metric: null, op: null, threshold: null };
  return s || {};
}

export function cmp(v: number, op: string | null | undefined, t: number): boolean {
  switch (op) {
    case '<': return v < t;
    case '>': return v > t;
    case '<=': return v <= t;
    case '>=': return v >= t;
    default: return false;
  }
}

// Base 20..80 dai verdetti delle task sorgente.
export async function verdictBase(supabase: any, userId: string, sourceIds: string[]): Promise<number> {
  if (!sourceIds?.length) return 50;
  const { data: tasks } = await supabase
    .from('tasks').select('output').eq('user_id', userId).in('id', sourceIds);
  let num = 0, den = 0;
  for (const t of tasks || []) {
    const v = t.output?.verdict;
    if (!v?.stance) continue;
    const sign = v.stance === 'si' ? 1 : v.stance === 'no' ? -1 : 0;
    const w = v.confidence === 'alta' ? 1 : v.confidence === 'media' ? 0.6 : v.confidence === 'bassa' ? 0.3 : 0.6;
    num += sign * w; den += w;
  }
  if (!den) return 50;
  const net = num / den; // -1..1
  return 50 + net * 30;
}

// Valuta i segnali testabili (fred/ticker) contro i dati di oggi; ritorna i
// segnali annotati con fired/checked_at e i conteggi scattati per direzione.
export async function evalSignals(signals: Signals | null | undefined, createdAt: string) {
  const now = new Date().toISOString();
  const out: { confirm: Signal[]; invalidate: Signal[] } = { confirm: [], invalidate: [] };
  let confirmFired = 0, invalidateFired = 0, testableTotal = 0;
  for (const dir of ['confirm', 'invalidate'] as const) {
    for (const raw of (signals?.[dir] || [])) {
      const s = normSig(raw);
      let fired = s.fired;
      if (s.metric && s.op && typeof s.threshold === 'number') {
        testableTotal++;
        if (s.kind === 'fred') {
          const v = await latestFredValue(s.metric);
          if (v !== null) { fired = cmp(v, s.op, s.threshold); s.checked_at = now; }
        } else if (s.kind === 'ticker') {
          const pct = await fetchTickerPerformance(s.metric, createdAt);
          if (pct !== null) { fired = cmp(pct, s.op, s.threshold); s.checked_at = now; }
        }
      }
      s.fired = fired;
      if (fired) { if (dir === 'confirm') confirmFired++; else invalidateFired++; }
      out[dir].push(s);
    }
  }
  return { signals: out, confirmFired, invalidateFired, testableTotal };
}

export function computeConfidence(base: number, confirmFired: number, invalidateFired: number): number {
  const adjust = Math.max(-20, Math.min(20, (confirmFired - invalidateFired) * 8));
  return Math.max(0, Math.min(100, Math.round(base + adjust)));
}

// Track record: esito della tesi DEDOTTO dai segnali reali scattati (zero attrito).
//  - status: confermata se la tesi tiene alta e solo i confirm sono scattati;
//    invalidata se prevalgono gli invalidate e la confidence è crollata; altrimenti attiva.
//  - accuracy: quota di segnali "giusti" tra quelli scattati (confirm vs invalidate);
//    null finché nessun segnale testabile è scattato (niente verdetto prematuro).
// Soglie centralizzate qui per essere ritoccabili.
export type ThesisStatus = 'active' | 'confirmed' | 'invalidated';

export function deriveOutcome(
  confirmFired: number,
  invalidateFired: number,
  testableTotal: number,
  confidence: number,
): { status: ThesisStatus; accuracy: number | null; signalsHit: number; signalsTotal: number } {
  const totalFired = confirmFired + invalidateFired;
  const accuracy = totalFired > 0 ? Math.round((confirmFired / totalFired) * 100) : null;
  let status: ThesisStatus = 'active';
  if (confidence >= 68 && confirmFired >= 1 && invalidateFired === 0) status = 'confirmed';
  else if (invalidateFired > confirmFired && confidence < 50) status = 'invalidated';
  return { status, accuracy, signalsHit: confirmFired, signalsTotal: testableTotal };
}

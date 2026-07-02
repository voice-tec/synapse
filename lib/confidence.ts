// Confidence di una tesi = blend di dati REALI, non un numero sparato dall'LLM.
//  - verdictBase: dai verdetti delle task sorgente (si/no/dipende × alta/media/bassa)
//  - evalSignals: quanti segnali testabili (FRED / prezzo ticker) sono scattati oggi
//  - computeConfidence: base + scarto dei segnali, in [0,100]
// Funzioni pure (cmp/computeConfidence/normSig) isolate per essere testabili.

import { latestFredValue } from '@/lib/fred';
import { fetchTickerPerformance } from '@/lib/quotes';
import { fetchFundamental } from '@/lib/fundamentals';

// 'fund' = fondamentale TTM (field dal catalogo FUND_FIELDS) del titolo in
// metric, via FMP (lib/fundamentals). 'pe' = alias legacy di fund/pe.
export type SignalKind = 'fred' | 'ticker' | 'fund' | 'pe' | 'manual';

export type Signal = {
  text?: string;
  kind?: SignalKind | string;
  metric?: string | null;        // id FRED (es. CPIAUCSL) o simbolo ticker; null se manual
  field?: string | null;         // per kind 'fund': quale fondamentale (FUND_FIELDS)
  op?: '<' | '>' | '<=' | '>=' | string | null;
  threshold?: number | null;
  // scritti dopo la valutazione:
  fired?: boolean;
  checked_at?: string;
  data_missing?: boolean;        // true se il dato non era disponibile al check (non conteggiato)
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

// Dipendenze iniettabili: i fetcher di dati reali. Default = quelli veri;
// negli unit test si passano stub (niente rete, niente mock dell'alias @/).
export type EvalDeps = {
  latestFredValue: (id: string) => Promise<number | null>;
  fetchTickerPerformance: (ticker: string, fromIso: string) => Promise<number | null>;
  // Opzionale per non rompere gli stub esistenti nei test; il default lo include.
  fetchFundamental?: (ticker: string, field: string) => Promise<number | null>;
};

// Valuta i segnali testabili (fred/ticker) contro i dati di oggi; ritorna i
// segnali annotati con fired/checked_at/data_missing e i conteggi scattati.
// Un segnale è "testabile" solo se il dato è DAVVERO disponibile al check: se il
// fetch fallisce (null) viene marcato data_missing, fired azzerato (niente stale)
// e NON conteggiato — così l'accuratezza poggia solo su segnali valutati per davvero.
export async function evalSignals(
  signals: Signals | null | undefined,
  createdAt: string,
  deps: EvalDeps = { latestFredValue, fetchTickerPerformance, fetchFundamental },
) {
  const now = new Date().toISOString();
  const out: { confirm: Signal[]; invalidate: Signal[] } = { confirm: [], invalidate: [] };
  let confirmFired = 0, invalidateFired = 0, testableTotal = 0;
  for (const dir of ['confirm', 'invalidate'] as const) {
    for (const raw of (signals?.[dir] || [])) {
      const s = normSig(raw);
      // 'pe' legacy = fund con field 'pe'; 'fund' richiede anche un field.
      const isFund = s.kind === 'fund' || s.kind === 'pe';
      const fundField = s.kind === 'pe' ? 'pe' : (s.field || null);
      const testable = !!s.metric && !!s.op && typeof s.threshold === 'number'
        && (s.kind === 'fred' || s.kind === 'ticker' || (isFund && !!fundField));
      if (testable) {
        const v = s.kind === 'fred'
          ? await deps.latestFredValue(s.metric as string)
          : isFund
            ? (deps.fetchFundamental ? await deps.fetchFundamental(s.metric as string, fundField as string) : null)
            : await deps.fetchTickerPerformance(s.metric as string, createdAt);
        if (v !== null) {
          s.fired = cmp(v, s.op, s.threshold as number);
          s.checked_at = now;
          s.data_missing = false;
          testableTotal++;
          if (s.fired) { if (dir === 'confirm') confirmFired++; else invalidateFired++; }
        } else {
          // dato non disponibile: niente verdetto, non conteggiato, no stale
          s.data_missing = true;
          s.fired = false;
        }
      }
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
// BARRA RIGOROSA: un verdetto (confermata/invalidata) non è una fotografia di un
// giorno fortunato. Una tesi ha al più ~2 confirm e ~2 invalidate testabili, quindi
// il rigore non sta nei grandi numeri ma nel pretendere:
//   - un CAMPIONE MINIMO: niente verdetto né accuratezza con meno di MIN_FIRED
//     segnali scattati (1 segnale solo = ancora 'in corso');
//   - CONFERME MULTIPLE: confermata richiede ≥2 confirm scattati (due conferme
//     indipendenti, non una), confidence con margine e ZERO invalidate scattati;
//   - INVALIDAZIONE NETTA: ≥2 invalidate scattati, nessun confirm, confidence crollata.
// Conseguenza voluta: "confermata ✓" è difficile da ottenere e non gonfiabile con
// un singolo segnale facile (requisito anti-gaming per un futuro marketplace).
export type ThesisStatus = 'active' | 'confirmed' | 'invalidated';

const MIN_FIRED = 2;          // campione minimo di segnali scattati per un verdetto/accuratezza
const CONF_CONFIRM = 72;      // confidence minima per confermare (margine sopra il neutro)
const CONF_INVALIDATE = 45;   // confidence sotto cui si può invalidare

export function deriveOutcome(
  confirmFired: number,
  invalidateFired: number,
  testableTotal: number,
  confidence: number,
): { status: ThesisStatus; accuracy: number | null; signalsHit: number; signalsTotal: number } {
  const totalFired = confirmFired + invalidateFired;
  // Accuratezza solo con campione sufficiente: niente % su n=1 (sarebbe 0% o 100% a caso).
  const accuracy = totalFired >= MIN_FIRED ? Math.round((confirmFired / totalFired) * 100) : null;
  let status: ThesisStatus = 'active';
  if (confidence >= CONF_CONFIRM && confirmFired >= MIN_FIRED && invalidateFired === 0) {
    status = 'confirmed';
  } else if (invalidateFired >= MIN_FIRED && confirmFired === 0 && confidence < CONF_INVALIDATE) {
    status = 'invalidated';
  }
  return { status, accuracy, signalsHit: confirmFired, signalsTotal: testableTotal };
}

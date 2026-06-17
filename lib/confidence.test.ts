import { describe, it, expect } from 'vitest';
import { cmp, computeConfidence, normSig, evalSignals, verdictBase } from './confidence';

describe('cmp', () => {
  it('confronta secondo l\'operatore', () => {
    expect(cmp(3, '<', 5)).toBe(true);
    expect(cmp(5, '<', 5)).toBe(false);
    expect(cmp(5, '<=', 5)).toBe(true);
    expect(cmp(6, '>', 5)).toBe(true);
    expect(cmp(5, '>=', 5)).toBe(true);
  });
  it('operatore ignoto o nullo → false', () => {
    expect(cmp(9, null, 1)).toBe(false);
    expect(cmp(9, '==' as any, 1)).toBe(false);
  });
});

describe('computeConfidence', () => {
  it('senza segnali resta la base', () => {
    expect(computeConfidence(50, 0, 0)).toBe(50);
  });
  it('i confirm scattati alzano, gli invalidate abbassano (8 a testa)', () => {
    expect(computeConfidence(50, 2, 0)).toBe(66);
    expect(computeConfidence(50, 0, 1)).toBe(42);
  });
  it('scarto limitato a ±20', () => {
    expect(computeConfidence(50, 5, 0)).toBe(70); // +40 → cap +20
    expect(computeConfidence(50, 0, 5)).toBe(30); // -40 → cap -20
  });
  it('risultato in [0,100]', () => {
    expect(computeConfidence(95, 2, 0)).toBe(100);
    expect(computeConfidence(5, 0, 2)).toBe(0);
  });
});

describe('normSig', () => {
  it('stringa legacy → oggetto manual', () => {
    expect(normSig('inflazione giù')).toEqual({ text: 'inflazione giù', kind: 'manual', metric: null, op: null, threshold: null });
  });
  it('oggetto passa invariato', () => {
    const s = { text: 'x', kind: 'fred', metric: 'CPIAUCSL', op: '<', threshold: 3 };
    expect(normSig(s)).toBe(s);
  });
});

// stub minimale del client supabase: from().select().eq().in() → { data }
const supabaseStub = (rows: any[]) => ({
  from: () => ({ select: () => ({ eq: () => ({ in: async () => ({ data: rows }) }) }) }),
});

describe('verdictBase', () => {
  it('nessuna task → 50', async () => {
    expect(await verdictBase(supabaseStub([]), 'u', [])).toBe(50);
  });
  it('un si/alta → 80', async () => {
    const rows = [{ output: { verdict: { stance: 'si', confidence: 'alta' } } }];
    expect(await verdictBase(supabaseStub(rows), 'u', ['t1'])).toBe(80);
  });
  it('un no/alta → 20', async () => {
    const rows = [{ output: { verdict: { stance: 'no', confidence: 'alta' } } }];
    expect(await verdictBase(supabaseStub(rows), 'u', ['t1'])).toBe(20);
  });
  it('si e no opposti → 50 (neutro)', async () => {
    const rows = [
      { output: { verdict: { stance: 'si', confidence: 'alta' } } },
      { output: { verdict: { stance: 'no', confidence: 'alta' } } },
    ];
    expect(await verdictBase(supabaseStub(rows), 'u', ['a', 'b'])).toBe(50);
  });
  it('senza verdetto → 50', async () => {
    const rows = [{ output: {} }, { output: { verdict: {} } }];
    expect(await verdictBase(supabaseStub(rows), 'u', ['a', 'b'])).toBe(50);
  });
});

describe('evalSignals (segnali manual, niente rete)', () => {
  it('normalizza e non scatta i manual', async () => {
    const signals = { confirm: [{ text: 'a', kind: 'manual' }], invalidate: ['stringa legacy'] };
    const r = await evalSignals(signals, new Date().toISOString());
    expect(r.confirmFired).toBe(0);
    expect(r.invalidateFired).toBe(0);
    expect(r.signals.confirm[0].text).toBe('a');
    expect(r.signals.invalidate[0].text).toBe('stringa legacy');
  });
});

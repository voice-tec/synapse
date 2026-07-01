import { describe, it, expect } from 'vitest';
import { trendingScore, pickTrending, type TrendingInput } from '@/lib/trending';

const NOW = new Date('2026-07-01T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

function tesi(id: string, over: Partial<TrendingInput> = {}): TrendingInput {
  return { id, status: 'active', created_at: daysAgo(30), closed_at: null, recentImports: 0, ...over };
}

describe('trendingScore', () => {
  it('vecchia, senza import né conferme → 0', () => {
    expect(trendingScore(tesi('a'), NOW)).toBe(0);
  });
  it('import recenti pesano ×2', () => {
    expect(trendingScore(tesi('a', { recentImports: 3 }), NOW)).toBe(6);
  });
  it('confermata negli ultimi 14gg → +3, oltre → 0', () => {
    expect(trendingScore(tesi('a', { status: 'confirmed', closed_at: daysAgo(5) }), NOW)).toBe(3);
    expect(trendingScore(tesi('a', { status: 'confirmed', closed_at: daysAgo(20) }), NOW)).toBe(0);
  });
  it('invalidata di recente NON prende il bonus conferma', () => {
    expect(trendingScore(tesi('a', { status: 'invalidated', closed_at: daysAgo(2) }), NOW)).toBe(0);
  });
  it('creata negli ultimi 7gg → +1', () => {
    expect(trendingScore(tesi('a', { created_at: daysAgo(3) }), NOW)).toBe(1);
  });
});

describe('pickTrending', () => {
  it('ordina per punteggio e taglia a n', () => {
    const out = pickTrending(
      [
        tesi('poca', { created_at: daysAgo(3) }), // 1
        tesi('tanta', { recentImports: 5 }), // 10
        tesi('media', { status: 'confirmed', closed_at: daysAgo(1) }), // 3
        tesi('zero'),
      ],
      2,
      NOW,
    );
    expect(out.map((t) => t.id)).toEqual(['tanta', 'media']);
  });
  it('fallback: nessuno score > 0 → confermate più recenti', () => {
    const out = pickTrending(
      [
        tesi('vecchia-attiva'),
        tesi('conf-vecchia', { status: 'confirmed', closed_at: daysAgo(60), created_at: daysAgo(90) }),
        tesi('conf-meno-vecchia', { status: 'confirmed', closed_at: daysAgo(40), created_at: daysAgo(50) }),
      ],
      2,
      NOW,
    );
    expect(out.map((t) => t.id)).toEqual(['conf-meno-vecchia', 'conf-vecchia']);
  });
  it('fallback finale: solo attive vecchie → le più recenti', () => {
    const out = pickTrending([tesi('a', { created_at: daysAgo(40) }), tesi('b', { created_at: daysAgo(20) })], 3, NOW);
    expect(out.map((t) => t.id)).toEqual(['b', 'a']);
  });
});

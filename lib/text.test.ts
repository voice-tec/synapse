import { describe, it, expect } from 'vitest';
import { wordOverlap } from './text';

describe('wordOverlap', () => {
  it('frase identica → 1', () => {
    expect(wordOverlap('inflazione USA in calo nel 2026', 'inflazione USA in calo nel 2026')).toBeCloseTo(1);
  });
  it('riformulazione con molte parole comuni → alto (≥0.55)', () => {
    const a = 'il portafoglio è troppo concentrato sul settore tech';
    const b = 'portafoglio troppo concentrato sul tech americano';
    expect(wordOverlap(a, b)).toBeGreaterThanOrEqual(0.55);
  });
  it('temi diversi → basso (<0.55)', () => {
    expect(wordOverlap('inflazione USA in calo', 'Nvidia trainata dalla domanda AI')).toBeLessThan(0.55);
  });
  it('stringa vuota → 0', () => {
    expect(wordOverlap('', 'qualcosa di lungo')).toBe(0);
  });
  it('ignora parole corte (<=3 char)', () => {
    // solo "casa" conta in entrambe → overlap pieno sul set significativo
    expect(wordOverlap('la mia casa', 'di casa')).toBeCloseTo(1);
  });
});

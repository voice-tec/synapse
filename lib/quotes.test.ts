import { describe, it, expect } from 'vitest';
import { sliceFrom, formatPerf } from './quotes';

const series = {
  dates: ['1 gen', '1 feb', '1 mar'],
  iso: ['2024-01-01', '2024-02-01', '2024-03-01'],
  closes: [10, 20, 30],
};

describe('sliceFrom', () => {
  it('taglia ai punti >= fromDay', () => {
    const r = sliceFrom(series, '2024-02-01')!;
    expect(r.closes).toEqual([20, 30]);
    expect(r.iso).toEqual(['2024-02-01', '2024-03-01']);
  });
  it('fromDay più vecchio di tutto → serie intera', () => {
    expect(sliceFrom(series, '2023-01-01')).toBe(series);
  });
  it('taglio che lascia <2 punti → ricade sulla serie intera', () => {
    expect(sliceFrom(series, '2024-03-15')).toBe(series);
  });
  it('null → null', () => {
    expect(sliceFrom(null, '2024-01-01')).toBeNull();
  });
});

describe('formatPerf', () => {
  it('segno e una cifra decimale', () => {
    expect(formatPerf(12.34)).toBe('+12.3%');
    expect(formatPerf(-5)).toBe('-5.0%');
  });
});

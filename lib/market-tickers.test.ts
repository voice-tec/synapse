import { describe, it, expect } from 'vitest';
import { extractTickers } from './market-tickers';

describe('extractTickers', () => {
  it('estrae i simboli dai kind ticker/fund/pe (metric), uppercase e dedup', () => {
    const signals = {
      confirm: [
        { kind: 'ticker', metric: 'nvda', text: 'NVDA +20%' },
        { kind: 'fund', metric: 'NVDA', field: 'pe', text: 'P/E sotto 40' },
        { kind: 'pe', metric: 'tsm', text: 'P/E TSMC' },
        { kind: 'fred', metric: 'CPIAUCSL', text: 'inflazione' },
      ],
      invalidate: [
        { kind: 'ticker', metric: 'AMD', text: 'AMD -15%' },
        { kind: 'manual', metric: null, text: 'nota qualitativa' },
      ],
    };
    expect(extractTickers(signals)).toEqual(['NVDA', 'TSM', 'AMD']);
  });

  it('ignora item stringa (legacy), segnali senza metric e input null', () => {
    expect(extractTickers(null)).toEqual([]);
    expect(extractTickers({})).toEqual([]);
    expect(extractTickers({ confirm: ['testo legacy', { kind: 'ticker', metric: '' }], invalidate: null })).toEqual([]);
  });
});

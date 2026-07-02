import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseFundField, fetchFundamental, fetchPeTTM, FUND_FIELDS, __clearPeCache } from './fundamentals';

// Riga realistica (nomi campo osservati sull'endpoint stable, 2026-07)
const ROW = {
  priceToEarningsRatioTTM: 23.18,
  priceToSalesRatioTTM: 9.11,
  priceToBookRatioTTM: 7.0,
  enterpriseValueMultipleTTM: 14.56,
  priceToEarningsGrowthRatioTTM: 0.78,
  priceToFreeCashFlowRatioTTM: 39.8,
  dividendYieldTTM: 0.00911,
  netProfitMarginTTM: 0.3934,
  grossProfitMarginTTM: 0.683,
  debtToEquityRatioTTM: 0.1374,
};

describe('parseFundField', () => {
  it('estrae ogni field del catalogo dalla riga stable', () => {
    expect(parseFundField([ROW], 'pe')).toBe(23.18);
    expect(parseFundField([ROW], 'ps')).toBe(9.11);
    expect(parseFundField([ROW], 'pb')).toBe(7.0);
    expect(parseFundField([ROW], 'ev_ebitda')).toBe(14.56);
    expect(parseFundField([ROW], 'peg')).toBe(0.78);
    expect(parseFundField([ROW], 'p_fcf')).toBe(39.8);
    expect(parseFundField([ROW], 'de')).toBe(0.1374);
  });
  it('frazioni → % per yield e margini', () => {
    expect(parseFundField([ROW], 'div_yield')).toBeCloseTo(0.911, 3);
    expect(parseFundField([ROW], 'net_margin')).toBeCloseTo(39.34, 2);
    expect(parseFundField([ROW], 'gross_margin')).toBeCloseTo(68.3, 1);
  });
  it('fallback sui nomi legacy v3 (incluso il typo dividendYielTTM)', () => {
    expect(parseFundField([{ peRatioTTM: 24.9 }], 'pe')).toBe(24.9);
    expect(parseFundField([{ dividendYielTTM: 0.02 }], 'div_yield')).toBe(2);
    expect(parseFundField([{ debtEquityRatioTTM: 1.1 }], 'de')).toBe(1.1);
  });
  it('field ignoto, payload vuoto o valore non numerico → null', () => {
    expect(parseFundField([ROW], 'ev_sales')).toBe(null);
    expect(parseFundField(null, 'pe')).toBe(null);
    expect(parseFundField([], 'pe')).toBe(null);
    expect(parseFundField([{ priceToEarningsRatioTTM: 'n/d' }], 'pe')).toBe(null);
  });
});

describe('fetchFundamental', () => {
  const KEY = 'test-key';
  beforeEach(() => { process.env.FMP_API_KEY = KEY; __clearPeCache(); });
  afterEach(() => { delete process.env.FMP_API_KEY; });

  it('senza FMP_API_KEY → null, nessuna fetch', async () => {
    delete process.env.FMP_API_KEY;
    let calls = 0;
    const v = await fetchFundamental('MSFT', 'pe', async () => { calls++; return [ROW]; });
    expect(v).toBe(null);
    expect(calls).toBe(0);
  });

  it('field ignoto → null senza fetch', async () => {
    let calls = 0;
    expect(await fetchFundamental('MSFT', 'ev_sales', async () => { calls++; return [ROW]; })).toBe(null);
    expect(calls).toBe(0);
  });

  it('field diversi dello stesso simbolo condividono la riga in cache: 1 sola fetch', async () => {
    let calls = 0;
    const f = async (u: string) => { calls++; return u.includes('/stable/') ? [ROW] : null; };
    expect(await fetchFundamental('msft ', 'pe', f)).toBe(23.18);
    expect(await fetchFundamental('MSFT', 'div_yield', f)).toBeCloseTo(0.911, 3);
    expect(await fetchFundamental('MSFT', 'de', f)).toBe(0.1374);
    expect(calls).toBe(1);
  });

  it('stable vuoto → fallback legacy v3', async () => {
    const urls: string[] = [];
    const v = await fetchFundamental('AAPL', 'pe', async (u) => {
      urls.push(u);
      return u.includes('/stable/') ? [] : [{ peRatioTTM: 27.1 }];
    });
    expect(v).toBe(27.1);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('/api/v3/ratios-ttm/AAPL');
  });

  it('risposta d\'errore v3 (oggetto non-array) → null, in cache', async () => {
    let calls = 0;
    const f = async (u: string) => { calls++; return u.includes('/stable/') ? [] : { 'Error Message': 'Legacy Endpoint' }; };
    expect(await fetchFundamental('XXXX', 'pe', f)).toBe(null);
    expect(await fetchFundamental('XXXX', 'ps', f)).toBe(null);
    expect(calls).toBe(2); // stable+v3 del primo giro; il secondo è cache (null)
  });

  it('fetch che lancia → null (mai propagare)', async () => {
    expect(await fetchFundamental('TSLA', 'pe', async () => { throw new Error('rete giù'); })).toBe(null);
  });

  it('fetchPeTTM resta come alias compat', async () => {
    expect(await fetchPeTTM('MSFT', async () => [ROW])).toBe(23.18);
  });
});

describe('FUND_FIELDS', () => {
  it('catalogo allineato al prompt di /api/memory', () => {
    expect(Object.keys(FUND_FIELDS).sort()).toEqual(
      ['de', 'div_yield', 'ev_ebitda', 'gross_margin', 'net_margin', 'p_fcf', 'pb', 'pe', 'peg', 'ps'],
    );
  });
});

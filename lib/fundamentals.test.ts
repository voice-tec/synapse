import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parsePeTTM, fetchPeTTM, __clearPeCache } from './fundamentals';

describe('parsePeTTM', () => {
  it('legge il campo dello stable endpoint', () => {
    expect(parsePeTTM([{ priceToEarningsRatioTTM: 31.4 }])).toBe(31.4);
  });
  it('legge il campo del legacy v3', () => {
    expect(parsePeTTM([{ peRatioTTM: 24.9 }])).toBe(24.9);
  });
  it('payload vuoto, non-array o valore non numerico → null', () => {
    expect(parsePeTTM(null)).toBe(null);
    expect(parsePeTTM([])).toBe(null);
    expect(parsePeTTM([{ peRatioTTM: 'n/d' }])).toBe(null);
    expect(parsePeTTM([{ peRatioTTM: NaN }])).toBe(null);
  });
});

describe('fetchPeTTM', () => {
  const KEY = 'test-key';
  beforeEach(() => { process.env.FMP_API_KEY = KEY; __clearPeCache(); });
  afterEach(() => { delete process.env.FMP_API_KEY; });

  it('senza FMP_API_KEY → null, nessuna fetch', async () => {
    delete process.env.FMP_API_KEY;
    let calls = 0;
    const v = await fetchPeTTM('MSFT', async () => { calls++; return [{ priceToEarningsRatioTTM: 30 }]; });
    expect(v).toBe(null);
    expect(calls).toBe(0);
  });

  it('endpoint stable risponde → valore, niente fallback', async () => {
    const urls: string[] = [];
    const v = await fetchPeTTM('msft ', async (u) => { urls.push(u); return [{ priceToEarningsRatioTTM: 33.2 }]; });
    expect(v).toBe(33.2);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/stable/ratios-ttm?symbol=MSFT');
  });

  it('stable vuoto → fallback legacy v3', async () => {
    const urls: string[] = [];
    const v = await fetchPeTTM('AAPL', async (u) => {
      urls.push(u);
      return u.includes('/stable/') ? [] : [{ peRatioTTM: 27.1 }];
    });
    expect(v).toBe(27.1);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('/api/v3/ratios-ttm/AAPL');
  });

  it('cache 24h: seconda chiamata non rifà la fetch (anche per i null)', async () => {
    let calls = 0;
    const ok = async () => { calls++; return [{ peRatioTTM: 20 }]; };
    await fetchPeTTM('NVDA', ok);
    await fetchPeTTM('NVDA', ok);
    expect(calls).toBe(1);
    // null in cache: simbolo non coperto non brucia il rate limit a ripetizione
    let nullCalls = 0;
    const ko = async () => { nullCalls++; return []; };
    expect(await fetchPeTTM('XXXX', ko)).toBe(null);
    expect(await fetchPeTTM('XXXX', ko)).toBe(null);
    expect(nullCalls).toBe(2); // stable+v3 del primo giro; il secondo giro è cache
  });

  it('fetch che lancia → null (mai propagare)', async () => {
    const v = await fetchPeTTM('TSLA', async () => { throw new Error('rete giù'); });
    expect(v).toBe(null);
  });
});

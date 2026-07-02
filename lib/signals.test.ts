import { describe, it, expect } from 'vitest';
import { validateSignals } from './signals';

const cluster = (signals: any) => ({ signals });
const fred = (metric: string) => ({ text: 'x', kind: 'fred', metric, op: '<', threshold: 3 });
const ticker = (metric: string) => ({ text: 'x', kind: 'ticker', metric, op: '>', threshold: 20 });
const fund = (metric: string, field: string | null) => ({ text: 'x', kind: 'fund', metric, field, op: '<', threshold: 25 });
const yes = async () => true;

describe('validateSignals', () => {
  it('metric FRED nel catalogo → invariata', async () => {
    const c = cluster({ confirm: [fred('CPIAUCSL')], invalidate: [] });
    await validateSignals([c], yes);
    expect(c.signals.confirm[0].kind).toBe('fred');
    expect(c.signals.confirm[0].metric).toBe('CPIAUCSL');
  });

  it('metric FRED fuori catalogo → declassata a manual', async () => {
    const c = cluster({ confirm: [fred('FAKE123')], invalidate: [] });
    await validateSignals([c], yes);
    expect(c.signals.confirm[0].kind).toBe('manual');
    expect(c.signals.confirm[0].metric).toBeNull();
    expect(c.signals.confirm[0].op).toBeNull();
    expect(c.signals.confirm[0].threshold).toBeNull();
    expect(c.signals.confirm[0].text).toBe('x'); // testo qualitativo preservato
  });

  it('ticker risolto (true) → invariato', async () => {
    const c = cluster({ confirm: [ticker('AAPL')], invalidate: [] });
    await validateSignals([c], async () => true);
    expect(c.signals.confirm[0].kind).toBe('ticker');
  });

  it('ticker non risolto definitivo (false) → manual', async () => {
    const c = cluster({ confirm: [], invalidate: [ticker('ZZZZ')] });
    await validateSignals([c], async () => false);
    expect(c.signals.invalidate[0].kind).toBe('manual');
    expect(c.signals.invalidate[0].metric).toBeNull();
  });

  it('ticker incerto (null) → invariato (no falsi declassamenti)', async () => {
    const c = cluster({ confirm: [ticker('NVDA')], invalidate: [] });
    await validateSignals([c], async () => null);
    expect(c.signals.confirm[0].kind).toBe('ticker');
  });

  it('fund con field nel catalogo e simbolo risolto → invariato', async () => {
    const c = cluster({ confirm: [fund('MSFT', 'net_margin')], invalidate: [] });
    await validateSignals([c], async () => true);
    expect(c.signals.confirm[0].kind).toBe('fund');
    expect(c.signals.confirm[0].field).toBe('net_margin');
  });

  it('fund con field fuori catalogo → manual (senza fetch del simbolo)', async () => {
    const c = cluster({ confirm: [fund('MSFT', 'ev_sales')], invalidate: [] });
    await validateSignals([c], async () => true);
    expect(c.signals.confirm[0].kind).toBe('manual');
    expect(c.signals.confirm[0].field).toBeNull();
  });

  it('fund senza field → manual', async () => {
    const c = cluster({ confirm: [fund('MSFT', null)], invalidate: [] });
    await validateSignals([c], async () => true);
    expect(c.signals.confirm[0].kind).toBe('manual');
  });

  it('fund con simbolo non risolto (false) → manual', async () => {
    const c = cluster({ confirm: [fund('ZZZZ', 'pe')], invalidate: [] });
    await validateSignals([c], async () => false);
    expect(c.signals.confirm[0].kind).toBe('manual');
  });
});

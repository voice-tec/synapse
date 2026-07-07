import { describe, it, expect } from 'vitest';
import { signalsPredicatesEqual, buildForkTree, type ForkRow } from './fork';

describe('signalsPredicatesEqual', () => {
  const sig = (over: any = {}) => ({
    text: 'NVDA +20% in 6 mesi', kind: 'ticker', metric: 'NVDA', op: 'gte', threshold: 20,
    // Stato di valutazione: NON deve pesare nel confronto (il fork parte azzerato).
    fired: true, checked_at: '2026-01-01', data_missing: false,
    ...over,
  });

  it('stessi predicati (anche con stato di valutazione diverso) → uguali', () => {
    const a = { confirm: [sig()], invalidate: [sig({ text: 'CPI sopra 4%', kind: 'fred', metric: 'CPIAUCSL', threshold: 4 })] };
    const b = {
      confirm: [sig({ fired: false, checked_at: null })],
      invalidate: [sig({ text: 'CPI sopra 4%', kind: 'fred', metric: 'CPIAUCSL', threshold: 4, data_missing: true })],
    };
    expect(signalsPredicatesEqual(a, b)).toBe(true);
  });

  it('threshold diverso → diversi', () => {
    expect(signalsPredicatesEqual({ confirm: [sig()], invalidate: [] }, { confirm: [sig({ threshold: 30 })], invalidate: [] })).toBe(false);
  });

  it('testo del segnale diverso → diversi', () => {
    expect(signalsPredicatesEqual({ confirm: [sig()], invalidate: [] }, { confirm: [sig({ text: 'NVDA +20% entro fine anno' })], invalidate: [] })).toBe(false);
  });

  it('segnale aggiunto/rimosso → diversi', () => {
    expect(signalsPredicatesEqual({ confirm: [sig()], invalidate: [] }, { confirm: [sig(), sig({ metric: 'AMD' })], invalidate: [] })).toBe(false);
  });

  it("l'ordine dei segnali nella stessa direzione non conta", () => {
    const s1 = sig(), s2 = sig({ metric: 'AMD', text: 'AMD -15%' });
    expect(signalsPredicatesEqual({ confirm: [s1, s2], invalidate: [] }, { confirm: [s2, s1], invalidate: [] })).toBe(true);
  });

  it('null/assenti su entrambi → uguali; su uno solo con segnali → diversi', () => {
    expect(signalsPredicatesEqual(null, null)).toBe(true);
    expect(signalsPredicatesEqual(null, { confirm: [], invalidate: [] })).toBe(true);
    expect(signalsPredicatesEqual(null, { confirm: [sig()], invalidate: [] })).toBe(false);
  });
});

describe('buildForkTree', () => {
  const row = (id: string, parent: string | null, over: Partial<ForkRow> = {}): ForkRow => ({
    id, imported_from_thesis: parent, thesis: `tesi ${id}`, user_id: `u-${id}`,
    confidence: 70, accuracy: null, status: 'active', ...over,
  });

  it('risale alla radice pubblica e ramifica in discesa', () => {
    // root → (a, b); a → a1. Target: a — l'albero deve partire da root.
    const rows = [row('root', null), row('a', 'root'), row('b', 'root'), row('a1', 'a')];
    const tree = buildForkTree(rows, 'a')!;
    expect(tree.id).toBe('root');
    expect(tree.children.map((c) => c.id).sort()).toEqual(['a', 'b']);
    const a = tree.children.find((c) => c.id === 'a')!;
    expect(a.children.map((c) => c.id)).toEqual(['a1']);
  });

  it('parent non nel set (privato/cancellato) → il nodo diventa radice visibile', () => {
    const rows = [row('x', 'sparita'), row('x1', 'x')];
    const tree = buildForkTree(rows, 'x')!;
    expect(tree.id).toBe('x');
    expect(tree.children.map((c) => c.id)).toEqual(['x1']);
  });

  it('target non presente → null', () => {
    expect(buildForkTree([row('a', null)], 'zzz')).toBeNull();
  });

  it('cap di profondità: la discesa si ferma a maxDepth', () => {
    // catena a0→a1→…→a9, target a0, maxDepth 3 → visibili a0..a3.
    const rows = Array.from({ length: 10 }, (_, i) => row(`a${i}`, i === 0 ? null : `a${i - 1}`));
    const tree = buildForkTree(rows, 'a0', 3)!;
    let depth = 0; let node = tree;
    while (node.children.length) { node = node.children[0]; depth++; }
    expect(depth).toBe(3);
  });

  it('guard sui cicli: non va in loop', () => {
    // a→b→a (corrotto): deve comunque terminare e contenere il target.
    const rows = [row('a', 'b'), row('b', 'a')];
    const tree = buildForkTree(rows, 'a');
    expect(tree).not.toBeNull();
  });

  it('albero singolo nodo: tesi mai forkata', () => {
    const tree = buildForkTree([row('solo', null)], 'solo')!;
    expect(tree.id).toBe('solo');
    expect(tree.children).toEqual([]);
  });
});

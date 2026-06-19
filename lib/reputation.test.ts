import { describe, it, expect } from 'vitest';
import { authorRep, authorRef } from './reputation';

describe('authorRef', () => {
  it('deterministico: stesso uid → stesso hash di 8 char', () => {
    const a = authorRef('user-123'), b = authorRef('user-123');
    expect(a).toBe(b);
    expect(a).toHaveLength(8);
  });
  it('uid diversi → hash diversi', () => {
    expect(authorRef('user-a')).not.toBe(authorRef('user-b'));
  });
});

describe('authorRep', () => {
  it('aggrega confermate/invalidate e accuratezza media', () => {
    const r = authorRep([
      { status: 'confirmed', accuracy: 100 },
      { status: 'confirmed', accuracy: 80 },
      { status: 'invalidated', accuracy: 0 },
      { status: 'active', accuracy: null },
    ]);
    expect(r.theses).toBe(4);
    expect(r.confirmed).toBe(2);
    expect(r.invalidated).toBe(1);
    expect(r.accuracy).toBe(60); // media di 100,80,0 (gli null esclusi)
  });
  it('nessuna accuratezza disponibile → null', () => {
    const r = authorRep([{ status: 'active' }, { status: 'active', accuracy: null }]);
    expect(r.accuracy).toBeNull();
    expect(r.confirmed).toBe(0);
  });
  it('lista vuota → zeri e accuratezza null', () => {
    expect(authorRep([])).toEqual({ theses: 0, confirmed: 0, invalidated: 0, accuracy: null });
  });
});

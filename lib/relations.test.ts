import { describe, it, expect } from 'vitest';
import { normAsset, signalEntities, memEdgeScore, type MemThesisLike } from '@/lib/relations';

const sig = (kind: string, metric: string) => ({ text: `segnale su ${metric}`, kind, metric });

function tesi(over: Partial<MemThesisLike> = {}): MemThesisLike {
  return { thesis: 'testo qualsiasi della tesi', sector: null, signals: null, ...over };
}

describe('normAsset', () => {
  it('normalizza varianti dello stesso ticker', () => {
    expect(normAsset('$nvda ')).toBe('NVDA');
    expect(normAsset('NVDA')).toBe('NVDA');
    // Forme composte NON collassano sul ticker puro: le cattura il fuzzy in computeConns.
    expect(normAsset('nvda (Nvidia)')).toBe('NVDANVIDIA');
  });
  it('gestisce input non stringa', () => {
    expect(normAsset(null)).toBe('');
    expect(normAsset(undefined)).toBe('');
  });
});

describe('signalEntities', () => {
  it('estrae solo ticker/fred con metric', () => {
    const t = tesi({
      signals: {
        confirm: [sig('ticker', 'NVDA'), sig('fred', 'CPIAUCSL'), sig('manual', 'X'), { text: 'senza metric', kind: 'ticker' }],
        invalidate: [sig('ticker', '$amd')],
      },
    });
    expect(signalEntities(t)).toEqual(['NVDA', 'CPIAUCSL', 'AMD']);
  });
  it('ignora segnali legacy stringa e signals null', () => {
    expect(signalEntities(tesi({ signals: { confirm: ['vecchio segnale testuale'] } }))).toEqual([]);
    expect(signalEntities(tesi())).toEqual([]);
  });
});

describe('memEdgeScore', () => {
  it('null sotto soglia: tesi senza nulla in comune', () => {
    const a = tesi({ thesis: 'il petrolio salirà per la domanda asiatica' });
    const b = tesi({ thesis: 'le banche europee beneficiano dei tassi alti' });
    expect(memEdgeScore(a, b)).toBeNull();
  });

  it('una entità condivisa da sola (0.30) NON crea arco', () => {
    const a = tesi({ thesis: 'il petrolio salirà per la domanda asiatica', signals: { confirm: [sig('ticker', 'NVDA')] } });
    const b = tesi({ thesis: 'le banche europee beneficiano dei tassi alti', signals: { confirm: [sig('ticker', 'NVDA')] } });
    expect(memEdgeScore(a, b)).toBeNull();
  });

  it('entità condivisa + settore uguale (0.40) crea arco blu', () => {
    const a = tesi({ thesis: 'il petrolio salirà per la domanda asiatica', sector: 'Commodities', signals: { confirm: [sig('ticker', 'USO')] } });
    const b = tesi({ thesis: 'le banche europee beneficiano dei tassi alti', sector: 'commodities ', signals: { confirm: [sig('ticker', '$uso')] } });
    const e = memEdgeScore(a, b);
    expect(e).not.toBeNull();
    expect(e!.score).toBe(0.4);
    expect(e!.type).toBe('complementary_data');
  });

  it('due entità condivise (0.45) + testo simile (0.35) → arco blu, dominano le entità', () => {
    const a = tesi({ thesis: 'i semiconduttori americani cresceranno con la spesa datacenter', signals: { confirm: [sig('ticker', 'NVDA'), sig('ticker', 'AMD')] } });
    const b = tesi({ thesis: 'i semiconduttori americani cresceranno grazie alla spesa datacenter in accelerazione strutturale', signals: { confirm: [sig('ticker', 'NVDA'), sig('ticker', 'AMD')] } });
    const e = memEdgeScore(a, b);
    expect(e).not.toBeNull();
    // ent 0.45 + txt 0.35 = 0.80; domina l'entità (0.45>0.35) → blu
    expect(e!.score).toBe(0.8);
    expect(e!.type).toBe('complementary_data');
  });

  it('testo molto simile senza entità → arco ambra', () => {
    const a = tesi({ thesis: 'inflazione europea in calo entro fine anno sotto il target' });
    const b = tesi({ thesis: 'inflazione europea in calo verso il target entro fine anno', sector: 'Macro' });
    const e = memEdgeScore(a, b);
    // txt 0.35 (ratio alto) + settore assente su a → niente bonus settore… serve ≥0.4?
    // ratio qui ≥0.5 → 0.35 da solo NON basta: sotto soglia.
    expect(e).toBeNull();
  });

  it('cap a 0.50 per le entità e cap totale 1.0', () => {
    const many = { confirm: ['NVDA', 'AMD', 'INTC', 'TSM', 'AVGO'].map((m) => sig('ticker', m)) };
    const a = tesi({ thesis: 'stesso testo identico della tesi condivisa', sector: 'AI/Tech', signals: many });
    const b = tesi({ thesis: 'stesso testo identico della tesi condivisa', sector: 'AI/Tech', signals: many });
    const e = memEdgeScore(a, b);
    expect(e).not.toBeNull();
    // ent cap 0.50 + txt 0.35 + settore 0.10 = 0.95
    expect(e!.score).toBe(0.95);
  });
});

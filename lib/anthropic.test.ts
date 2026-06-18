import { describe, it, expect } from 'vitest';
import { extractJSON } from './anthropic';

describe('extractJSON', () => {
  it('parsa JSON pulito', () => {
    expect(extractJSON('{"clusters":[]}')).toEqual({ clusters: [] });
  });

  it('toglie i fence ```json', () => {
    expect(extractJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('recupera JSON troncato dentro un array signals annidato', () => {
    // Output Haiku tagliato a max_tokens dentro signals.confirm del 2° cluster.
    const truncated = `{
  "clusters": [
    {
      "action": "new",
      "existing_id": null,
      "id": "concentration_tech_hedge",
      "confidence": 72,
      "thesis": "Il portafoglio è troppo concentrato sul tech",
      "signals": {
        "confirm": [{ "text": "drawdown nasdaq", "kind": "ticker", "metric": "QQQ" }],
        "invalidate": [{ "text": "rotazione settoriale", "kind": "manual" }]
      }
    },
    {
      "action": "forming",
      "existing_id": null,
      "id": "rate_cut_2026",
      "confidence": 58,
      "thesis": "I tagli dei tassi nel 2026 favoriscono i bond",
      "signals": {
        "confirm": [{ "text": "CPI in calo", "kind": "fred", "metric": "CPIAUCSL", "op": "<", "thresh`;
    const r = extractJSON(truncated);
    expect(Array.isArray(r.clusters)).toBe(true);
    // Almeno il primo cluster completo deve sopravvivere al recovery.
    expect(r.clusters[0].id).toBe('concentration_tech_hedge');
    expect(r.clusters[0].confidence).toBe(72);
  });

  it('lancia su testo senza JSON', () => {
    expect(() => extractJSON('niente json qui')).toThrow();
  });
});

// Tassonomia chiusa dei settori per le tesi. Lista fissa (non free-text) così il
// filtro del marketplace ha buckets consistenti e il dropdown resta pulito.
// Il clustering Haiku (app/api/memory) mappa ogni tesi a uno di questi valori;
// 'Tematico' è il fallback quando il settore non è chiaro.
export const SECTORS = [
  'Azioni',
  'Macro',
  'Obbligazioni/Rates',
  'Crypto',
  'Commodities',
  'FX',
  'Real Estate',
  'AI/Tech',
  'Energia/Transizione',
  'Geopolitica',
  'Altro',
] as const;

export type Sector = (typeof SECTORS)[number];

// Normalizza un valore arbitrario (es. output LLM) a un settore valido, oppure
// 'Altro' di default. Match case-insensitive sull'etichetta.
export function normalizeSector(v: unknown): Sector {
  if (typeof v === 'string') {
    const hit = SECTORS.find((s) => s.toLowerCase() === v.trim().toLowerCase());
    if (hit) return hit;
  }
  return 'Altro';
}

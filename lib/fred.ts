// Dati macro UFFICIALI da FRED (Federal Reserve Bank of St. Louis).
// API gratuita e generosa (richiede FRED_API_KEY, https://fred.stlouisfed.org).
// Due usi:
//  - fredSeries: serie per i grafici (fonte autoritativa, niente AI)
//  - macroSnapshot: blocco testuale coi valori macro chiave, iniettato nei
//    prompt (analyze, refresh tesi, challenge) così le affermazioni macro
//    del modello poggiano su numeri veri invece che su training o web_search.
// Senza chiave tutto degrada in silenzio: snapshot null, grafici macro
// ricadono su ticker o stima etichettata.

const FRED_KEY = process.env.FRED_API_KEY;
const OBS_URL = 'https://api.stlouisfed.org/fred/series/observations';

// Whitelist: il modello può chiedere SOLO queste serie. Niente ID inventati.
// yoy: serie in livelli (indici) mostrate come variazione % anno su anno.
export const FRED_CATALOG: Record<string, { label: string; unit: string; yoy?: boolean }> = {
  CPIAUCSL: { label: 'Inflazione USA (CPI, YoY)', unit: '%', yoy: true },
  FEDFUNDS: { label: 'Tasso Fed Funds', unit: '%' },
  DGS10: { label: 'Treasury 10 anni', unit: '%' },
  DGS2: { label: 'Treasury 2 anni', unit: '%' },
  T10Y2Y: { label: 'Spread 10Y-2Y', unit: '%' },
  UNRATE: { label: 'Disoccupazione USA', unit: '%' },
  GDPC1: { label: 'PIL reale USA (YoY)', unit: '%', yoy: true },
  M2SL: { label: 'Massa monetaria M2 (YoY)', unit: '%', yoy: true },
  DTWEXBGS: { label: 'Dollaro USA (indice broad)', unit: '' },
  DCOILWTICO: { label: 'Petrolio WTI', unit: '$' },
};

type Obs = { date: string; value: number };

async function fredObs(seriesId: string, params: string): Promise<Obs[] | null> {
  if (!FRED_KEY) return null;
  try {
    const r = await fetch(`${OBS_URL}?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&${params}`);
    const j = await r.json();
    if (!j.observations?.length) return null;
    const out: Obs[] = [];
    for (const o of j.observations) {
      const v = parseFloat(o.value); // FRED usa '.' per i buchi
      if (!isNaN(v)) out.push({ date: o.date, value: v });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

// Variazione % vs l'osservazione di ~un anno prima (obs in ordine cronologico)
function yoyOf(obs: Obs[], i: number): number | null {
  const target = new Date(obs[i].date).getTime() - 360 * 24 * 3600 * 1000;
  let prev: Obs | null = null;
  for (let k = 0; k < i; k++) {
    if (new Date(obs[k].date).getTime() <= target) prev = obs[k];
    else break;
  }
  return prev ? (obs[i].value / prev.value - 1) * 100 : null;
}

// Serie per i grafici. Per le serie yoy scarica ~13 mesi extra per poter
// calcolare la variazione annua già dal primo punto della finestra.
export async function fredSeries(seriesId: string, fromIso: string) {
  const meta = FRED_CATALOG[seriesId];
  if (!meta) return null;
  const fromMs = new Date(fromIso).getTime();
  const start = new Date(meta.yoy ? fromMs - 400 * 24 * 3600 * 1000 : fromMs);
  const obs = await fredObs(seriesId, `observation_start=${start.toISOString().slice(0, 10)}`);
  if (!obs) return null;

  const points: Obs[] = [];
  for (let i = 0; i < obs.length; i++) {
    if (new Date(obs[i].date).getTime() < fromMs) continue;
    const v = meta.yoy ? yoyOf(obs, i) : obs[i].value;
    if (v !== null) points.push({ date: obs[i].date, value: v });
  }
  return points.length >= 2 ? { meta, points } : null;
}

// ── Snapshot macro per i prompt ──
// Cache nel modulo (12h): i dati cambiano al più mensilmente, e lo snapshot
// è identico per tutti gli utenti — una manciata di chiamate FRED al giorno.
const SNAPSHOT_IDS = ['CPIAUCSL', 'FEDFUNDS', 'DGS10', 'T10Y2Y', 'UNRATE'];
let snapCache: { at: number; text: string | null } = { at: 0, text: null };

export async function macroSnapshot(): Promise<string | null> {
  if (!FRED_KEY) return null;
  if (Date.now() - snapCache.at < 12 * 3600 * 1000) return snapCache.text;

  const lines: string[] = [];
  await Promise.all(
    SNAPSHOT_IDS.map(async (id) => {
      const meta = FRED_CATALOG[id];
      const desc = await fredObs(id, 'sort_order=desc&limit=20');
      if (!desc?.length) return;
      const obs = [...desc].reverse();
      const i = obs.length - 1;
      const v = meta.yoy ? yoyOf(obs, i) : obs[i].value;
      if (v === null) return;
      const when = new Date(obs[i].date).toLocaleDateString('it', { month: 'short', year: 'numeric' });
      lines.push(`- ${meta.label}: ${v.toFixed(2)}${meta.unit} (${when})`);
    })
  );

  const text = lines.length
    ? `DATI MACRO UFFICIALI (FRED, Federal Reserve St. Louis), già verificati:\n${lines.sort().join('\n')}\nPer ogni affermazione macro USA usa QUESTI numeri: sono la fonte autoritativa. Non cercare sul web ciò che è già qui.`
    : null;
  snapCache = { at: Date.now(), text };
  return text;
}

// ── Valore corrente di una serie, per i predicati testabili dei segnali ──
// Ritorna l'ultimo valore numerico (yoy rispettato) di una serie del catalogo.
// Solo id whitelisted; cache 12h per id (i dati cambiano al più mensilmente).
const valCache = new Map<string, { at: number; v: number | null }>();
export async function latestFredValue(id: string): Promise<number | null> {
  if (!FRED_KEY) return null;
  const meta = FRED_CATALOG[id];
  if (!meta) return null;
  const c = valCache.get(id);
  if (c && Date.now() - c.at < 12 * 3600 * 1000) return c.v;
  const desc = await fredObs(id, 'sort_order=desc&limit=20');
  let v: number | null = null;
  if (desc?.length) {
    const obs = [...desc].reverse();
    const i = obs.length - 1;
    v = meta.yoy ? yoyOf(obs, i) : obs[i].value;
  }
  valCache.set(id, { at: Date.now(), v });
  return v;
}

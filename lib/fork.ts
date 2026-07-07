// Meccanica "fork" del marketplace (GitHub delle tesi):
// - signalsPredicatesEqual: un fork è ripubblicabile solo se MODIFICATO
//   rispetto all'origine; qui si confrontano i predicati dei segnali
//   (testo/kind/metric/op/threshold), MAI lo stato di valutazione
//   (fired/checked_at/data_missing) che nel fork parte azzerato.
// - buildForkTree: Knowledge Tree — dal target si risale alla radice
//   pubblica via imported_from_thesis, poi si discende in ampiezza.
// Funzioni pure: testabili, nessun accesso a DB.

// Firma stabile del predicato di un segnale, indipendente dall'ordine.
function predKey(s: any): string {
  if (!s) return '';
  if (typeof s === 'string') return `manual|${s.trim().toLowerCase()}`;
  return [
    String(s.text ?? '').trim().toLowerCase(),
    String(s.kind ?? 'manual'),
    String(s.metric ?? ''),
    String(s.op ?? ''),
    String(s.threshold ?? ''),
  ].join('|');
}

function dirKeys(arr: any[]): string[] {
  return (arr || []).map(predKey).filter(Boolean).sort();
}

export function signalsPredicatesEqual(a: any, b: any): boolean {
  const ka = dirKeys(a?.confirm).concat('—', dirKeys(a?.invalidate));
  const kb = dirKeys(b?.confirm).concat('—', dirKeys(b?.invalidate));
  return ka.join('\n') === kb.join('\n');
}

// Riga minima per costruire l'albero (solo tesi PUBBLICHE: i figli privati
// vengono aggregati a parte dal chiamante, mai esposti come nodi).
export type ForkRow = {
  id: string;
  imported_from_thesis: string | null;
  thesis: string | null;
  user_id: string;
  confidence: number | null;
  accuracy: number | null;
  status: string | null;
};

export type ForkNode = {
  id: string;
  thesis: string;
  user_id: string;
  confidence: number | null;
  accuracy: number | null;
  status: string;
  children: ForkNode[];
};

// Albero dei fork attorno a `targetId`. Radice = antenato più alto ancora nel
// set (un parent privato/cancellato tronca la risalita: il lineage privato non
// si espone). maxDepth limita la DISCESA dalla radice; guard sui cicli (dati
// corrotti non devono bloccare la pagina). Ritorna null se il target manca.
export function buildForkTree(rows: ForkRow[], targetId: string, maxDepth = 6): ForkNode | null {
  const byId = new Map<string, ForkRow>();
  for (const r of rows || []) byId.set(r.id, r);
  if (!byId.has(targetId)) return null;

  // Risalita con guard: se rincontro un id già visto (ciclo), mi fermo lì.
  let rootId = targetId;
  const seen = new Set<string>([targetId]);
  while (true) {
    const parent = byId.get(rootId)?.imported_from_thesis;
    if (!parent || !byId.has(parent) || seen.has(parent)) break;
    seen.add(parent);
    rootId = parent;
  }

  const childrenOf = new Map<string, ForkRow[]>();
  for (const r of Array.from(byId.values())) {
    if (r.imported_from_thesis && byId.has(r.imported_from_thesis)) {
      if (!childrenOf.has(r.imported_from_thesis)) childrenOf.set(r.imported_from_thesis, []);
      childrenOf.get(r.imported_from_thesis)!.push(r);
    }
  }

  const build = (id: string, depth: number, visited: Set<string>): ForkNode => {
    const r = byId.get(id)!;
    const kids = depth >= maxDepth ? [] : (childrenOf.get(id) || []).filter((k) => !visited.has(k.id));
    for (const k of kids) visited.add(k.id);
    return {
      id: r.id,
      thesis: r.thesis || '',
      user_id: r.user_id,
      confidence: r.confidence ?? null,
      accuracy: r.accuracy ?? null,
      status: r.status || 'active',
      children: kids.map((k) => build(k.id, depth + 1, visited)),
    };
  };

  return build(rootId, 0, new Set([rootId]));
}

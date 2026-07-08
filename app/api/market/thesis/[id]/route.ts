import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { authorRep, authorRef } from '@/lib/reputation';
import { normalizeSector } from '@/lib/sectors';
import { buildForkTree, type ForkNode } from '@/lib/fork';
import { extractTickers } from '@/lib/market-tickers';

// Dettaglio pubblico di una tesi del marketplace ("GitHub delle tesi"):
// tesi completa con lo stato dei segnali, autore (ref opaco + reputazione),
// evoluzione (history) e Knowledge Tree — l'albero dei fork con track record
// per nodo. Lettura cross-utente → service role; risponde SOLO se is_public
// (404 altrimenti: una tesi privata non deve nemmeno risultare esistente,
// e un id malformato — cast uuid fallito — dà lo stesso 404).

// Vista segnale: testo + stato, mai i parametri interni (metric/op/threshold).
function sigView(arr: any[]) {
  return (arr || [])
    .map((s: any) => (typeof s === 'string' ? { text: s, kind: 'manual' } : s))
    .filter((s: any) => s && s.text)
    .map((s: any) => ({
      text: s.text,
      kind: s.kind || 'manual',
      fired: !!s.fired,
      data_missing: !!s.data_missing,
      checked_at: s.checked_at || null,
    }));
}

// Nodo dell'albero per il client: autore come ref opaco, mai lo user_id.
type TreeOut = {
  id: string; thesis: string; author: string; authorName: string | null;
  confidence: number | null; accuracy: number | null; status: string;
  privateImports: number; children: TreeOut[];
};
function toTreeOut(n: ForkNode, names: Map<string, string>, privCounts: Map<string, number>): TreeOut {
  return {
    id: n.id,
    thesis: (n.thesis || '').slice(0, 140),
    author: authorRef(n.user_id),
    authorName: names.get(n.user_id) || null,
    confidence: n.confidence,
    accuracy: n.accuracy,
    status: n.status,
    privateImports: privCounts.get(n.id) || 0,
    children: n.children.map((c) => toTreeOut(c, names, privCounts)),
  };
}
function treeUserIds(n: ForkNode, acc: Set<string>) {
  acc.add(n.user_id);
  for (const c of n.children) treeUserIds(c, acc);
}
function treeIds(n: ForkNode, acc: string[]) {
  acc.push(n.id);
  for (const c of n.children) treeIds(c, acc);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = (params.id || '').trim();
  if (!id) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const admin = createAdminClient();
  const { data: t, error } = await admin
    .from('theses')
    .select('id, user_id, thesis, confidence, explanation, signals, status, accuracy, sector, history, created_at, updated_at')
    .eq('id', id).eq('is_public', true)
    .maybeSingle();
  if (error || !t) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [{ data: prof }, { data: allMine }, { data: pubAll }] = await Promise.all([
    admin.from('profiles').select('display_name').eq('id', t.user_id).maybeSingle(),
    // Reputazione su TUTTE le tesi dell'autore (anche private), come in vetrina.
    admin.from('theses').select('status, accuracy').eq('user_id', t.user_id),
    // Pool per l'albero: solo tesi pubbliche (bounded, come la vetrina). Il
    // lineage che passa da tesi private resta invisibile per costruzione.
    admin.from('theses')
      .select('id, user_id, thesis, confidence, accuracy, status, imported_from_thesis')
      .eq('is_public', true).limit(1000),
  ]);

  const tree = buildForkTree(pubAll || [], t.id);

  // Per i nodi dell'albero: nomi pubblici degli autori + import privati
  // (figli non pubblici, aggregati come conteggio — mai esposti come nodi).
  let treeOut: TreeOut | null = null;
  let imports = 0;
  let forks = 0;
  if (tree) {
    const ids: string[] = [];
    treeIds(tree, ids);
    const uidSet = new Set<string>();
    treeUserIds(tree, uidSet);
    const uids = Array.from(uidSet);

    const [{ data: profs }, { data: clones }] = await Promise.all([
      admin.from('profiles').select('id, display_name').in('id', uids),
      admin.from('theses').select('imported_from_thesis, is_public').in('imported_from_thesis', ids),
    ]);
    const names = new Map<string, string>();
    for (const p of profs || []) if (p.display_name) names.set(p.id, p.display_name);
    const privCounts = new Map<string, number>();
    for (const c of clones || []) {
      if (!c.imported_from_thesis) continue;
      if (!c.is_public) privCounts.set(c.imported_from_thesis, (privCounts.get(c.imported_from_thesis) || 0) + 1);
      if (c.imported_from_thesis === t.id) {
        imports++;
        if (c.is_public) forks++;
      }
    }
    treeOut = toTreeOut(tree, names, privCounts);
  }

  const now = Date.now();
  const daysOnline = t.created_at ? Math.max(0, Math.floor((now - new Date(t.created_at).getTime()) / 86400000)) : 0;

  return NextResponse.json(
    {
      id: t.id,
      thesis: t.thesis,
      confidence: t.confidence,
      explanation: t.explanation,
      status: t.status || 'active',
      accuracy: t.accuracy ?? null,
      sector: normalizeSector(t.sector),
      created_at: t.created_at,
      updated_at: t.updated_at || t.created_at,
      daysOnline,
      // Ticker dai segnali: alimenta la sparkline dell'hero (era assente e
      // la sparkline non veniva mai renderizzata nel dettaglio).
      tickers: extractTickers(t.signals),
      signals: t.signals ? { confirm: sigView(t.signals.confirm), invalidate: sigView(t.signals.invalidate) } : null,
      // Evoluzione: pubblicare una tesi pubblica anche la sua storia (detto
      // esplicitamente nel copy della pagina).
      history: Array.isArray(t.history) ? t.history : [],
      author: { ref: authorRef(t.user_id), name: prof?.display_name || null, rep: authorRep(allMine || []) },
      imports,
      forks,
      tree: treeOut,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  );
}

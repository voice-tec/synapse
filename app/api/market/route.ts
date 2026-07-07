import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { authorRep, authorRef } from '@/lib/reputation';
import { normalizeSector } from '@/lib/sectors';
import { extractTickers } from '@/lib/market-tickers';

// Vetrina marketplace: tesi pubbliche di tutti gli utenti, con la reputazione
// (anonima) dell'autore. Lettura cross-utente → service role (RLS bloccherebbe).
// Autore non identificato: solo un riferimento opaco (hash) per raggruppare le
// tesi dello stesso autore senza esporne l'identità.
//
// Due query filtrate (non un dump): la select non filtrata è troncata a 1000
// righe da Supabase, e le tesi private mangerebbero quel tetto facendo sparire
// le pubbliche. Quindi: 1) prendi solo le pubbliche, 2) prendi le tesi degli
// stessi autori (anche private) solo per calcolare la reputazione.
// Paginazione a offset IN MEMORIA (non cursore DB): il sort di default
// "reputazione" è un aggregato calcolato qui (non esprimibile come order by),
// e il dataset è bounded (max 20 pubbliche/autore). La CDN Vercel usa l'URL
// completo (query string inclusa) come chiave: ogni pagina/sort è una entry
// di cache distinta, s-maxage continua a funzionare.
export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const params = req.nextUrl.searchParams;
  const sectorFilter = params.get('sector')?.trim() || '';
  // status=confirmed → sezione "Confermate" della home (solo verdetti chiusi positivi).
  const statusFilter = params.get('status') === 'confirmed' ? 'confirmed' : '';
  const sort = ['rep', 'recent', 'accuracy'].includes(params.get('sort') || '') ? params.get('sort')! : 'rep';
  const limit = Math.min(50, Math.max(1, parseInt(params.get('limit') || '20', 10) || 20));
  const offset = Math.min(500, Math.max(0, parseInt(params.get('offset') || '0', 10) || 0));

  let pubQ = admin
    .from('theses')
    .select('id, user_id, thesis, confidence, explanation, signals, status, accuracy, created_at, updated_at, sector')
    .eq('is_public', true)
    // Tetto Supabase: oltre 1000 pubbliche il totale diventa "almeno 1000".
    // Accettato oggi (max 20 pubbliche/autore = servono 50+ autori attivi).
    .limit(1000);
  if (sectorFilter) pubQ = pubQ.eq('sector', sectorFilter);
  if (statusFilter) pubQ = pubQ.eq('status', statusFilter);

  const { data: pub, error: pubErr } = await pubQ;
  if (pubErr) return NextResponse.json({ error: 'market_unavailable' }, { status: 500 });

  const pubRows = pub || [];
  const pubUserIds = Array.from(new Set(pubRows.map((t) => t.user_id)));

  // Reputazione per autore: serve l'aggregato su TUTTE le sue tesi (anche private),
  // ma limitato agli autori che hanno almeno una pubblica → query mirata, niente dump.
  const byUser = new Map<string, { status?: string | null; accuracy?: number | null }[]>();
  const nameByUser = new Map<string, string>();
  if (pubUserIds.length) {
    const { data: repRows, error: repErr } = await admin
      .from('theses')
      .select('user_id, status, accuracy')
      .in('user_id', pubUserIds);
    if (repErr) return NextResponse.json({ error: 'market_unavailable' }, { status: 500 });
    for (const t of repRows || []) {
      if (!byUser.has(t.user_id)) byUser.set(t.user_id, []);
      byUser.get(t.user_id)!.push(t);
    }

    const { data: profs, error: profErr } = await admin
      .from('profiles').select('id, display_name').in('id', pubUserIds);
    if (profErr) return NextResponse.json({ error: 'market_unavailable' }, { status: 500 });
    for (const p of profs || []) if (p.display_name) nameByUser.set(p.id, p.display_name);
  }

  const sigText = (arr: any[]) => (arr || []).map((s: any) => (typeof s === 'string' ? s : s?.text)).filter(Boolean);

  const all = pubRows.map((t) => ({
    id: t.id,
    thesis: t.thesis,
    confidence: t.confidence,
    explanation: t.explanation,
    status: t.status || 'active',
    accuracy: t.accuracy ?? null,
    created_at: t.created_at,
    updated_at: t.updated_at || t.created_at,
    sector: normalizeSector(t.sector),
    tickers: extractTickers(t.signals),
    signals: t.signals ? { confirm: sigText(t.signals.confirm), invalidate: sigText(t.signals.invalidate) } : null,
    author: authorRef(t.user_id),
    authorName: nameByUser.get(t.user_id) || null,
    authorRep: authorRep(byUser.get(t.user_id) || []),
    imports: 0,
    forks: 0,
  }));

  const recency = (a: { created_at: string }, b: { created_at: string }) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  if (sort === 'recent') {
    all.sort(recency);
  } else if (sort === 'accuracy') {
    // Accuracy della SINGOLA tesi (null in fondo), non dell'autore.
    all.sort((a, b) => ((b.accuracy ?? -1) - (a.accuracy ?? -1)) || recency(a, b));
  } else {
    // Ranking default: prima le tesi di autori più affidabili, poi le più recenti.
    all.sort((a, b) =>
      (b.authorRep.confirmed - a.authorRep.confirmed) ||
      ((b.authorRep.accuracy ?? -1) - (a.authorRep.accuracy ?? -1)) ||
      recency(a, b),
    );
  }

  const items = all.slice(offset, offset + limit);

  // Import e fork ricevuti: cloni che puntano alle tesi in pagina; un clone a
  // sua volta pubblico è un FORK (lineage visibile nel Knowledge Tree).
  // Fatto DOPO lo slice (solo gli id in pagina), per restare leggeri.
  if (items.length) {
    const { data: clones } = await admin
      .from('theses')
      .select('imported_from_thesis, is_public')
      .in('imported_from_thesis', items.map((i) => i.id));
    const counts = new Map<string, number>();
    const forkCounts = new Map<string, number>();
    for (const c of clones || []) {
      if (!c.imported_from_thesis) continue;
      counts.set(c.imported_from_thesis, (counts.get(c.imported_from_thesis) || 0) + 1);
      if (c.is_public) forkCounts.set(c.imported_from_thesis, (forkCounts.get(c.imported_from_thesis) || 0) + 1);
    }
    for (const i of items) { i.imports = counts.get(i.id) || 0; i.forks = forkCounts.get(i.id) || 0; }
  }

  return NextResponse.json(
    { items, total: all.length, hasMore: offset + limit < all.length, offset, limit },
    { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } },
  );
}

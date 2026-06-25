import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { authorRep, authorRef } from '@/lib/reputation';
import { normalizeSector } from '@/lib/sectors';

// Vetrina marketplace: tesi pubbliche di tutti gli utenti, con la reputazione
// (anonima) dell'autore. Lettura cross-utente → service role (RLS bloccherebbe).
// Autore non identificato: solo un riferimento opaco (hash) per raggruppare le
// tesi dello stesso autore senza esporne l'identità.
//
// Due query filtrate (non un dump): la select non filtrata è troncata a 1000
// righe da Supabase, e le tesi private mangerebbero quel tetto facendo sparire
// le pubbliche. Quindi: 1) prendi solo le pubbliche, 2) prendi le tesi degli
// stessi autori (anche private) solo per calcolare la reputazione.
export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const sectorFilter = req.nextUrl.searchParams.get('sector')?.trim() || '';

  let pubQ = admin
    .from('theses')
    .select('id, user_id, thesis, confidence, explanation, signals, status, accuracy, created_at, sector')
    .eq('is_public', true);
  if (sectorFilter) pubQ = pubQ.eq('sector', sectorFilter);

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

  const items = pubRows
    .map((t) => ({
      id: t.id,
      thesis: t.thesis,
      confidence: t.confidence,
      explanation: t.explanation,
      status: t.status || 'active',
      created_at: t.created_at,
      sector: normalizeSector(t.sector),
      signals: t.signals ? { confirm: sigText(t.signals.confirm), invalidate: sigText(t.signals.invalidate) } : null,
      author: authorRef(t.user_id),
      authorName: nameByUser.get(t.user_id) || null,
      authorRep: authorRep(byUser.get(t.user_id) || []),
    }))
    // Ranking: prima le tesi di autori più affidabili, poi le più recenti.
    .sort((a, b) =>
      (b.authorRep.confirmed - a.authorRep.confirmed) ||
      ((b.authorRep.accuracy ?? -1) - (a.authorRep.accuracy ?? -1)) ||
      (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    );

  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } },
  );
}

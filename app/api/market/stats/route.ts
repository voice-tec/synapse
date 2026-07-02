import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { authorRep, authorRef } from '@/lib/reputation';
import { normalizeSector } from '@/lib/sectors';
import { pickTrending } from '@/lib/trending';

// Stats aggregate + tesi in evidenza per la dashboard marketplace. Endpoint
// separato da /api/market così la pagina fa due fetch paralleli e le stats
// (metriche soft) possono avere una cache più lunga della lista.
// Lettura cross-utente → service role.
// force-dynamic: senza input request-dipendenti Next marcherebbe la route
// statica e congelerebbe le stats al build. La cache vive nell'header CDN.
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = createAdminClient();

  const { data: pub, error: pubErr } = await admin
    .from('theses')
    .select('id, user_id, thesis, confidence, explanation, status, accuracy, sector, created_at, closed_at')
    .eq('is_public', true)
    .limit(1000); // tetto Supabase: oltre, le stats diventano "almeno"
  if (pubErr) return NextResponse.json({ error: 'stats_unavailable' }, { status: 500 });
  const pubRows = pub || [];

  // Import ricevuti negli ultimi 14gg, per tesi (alimenta il punteggio trending).
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const recentImports = new Map<string, number>();
  if (pubRows.length) {
    const { data: clones } = await admin
      .from('theses')
      .select('imported_from_thesis')
      .gte('created_at', cutoff)
      .in('imported_from_thesis', pubRows.map((t) => t.id));
    for (const c of clones || []) {
      if (c.imported_from_thesis) recentImports.set(c.imported_from_thesis, (recentImports.get(c.imported_from_thesis) || 0) + 1);
    }
  }

  // Accuracy media per settore (solo tesi con accuracy valutata).
  const bySector = new Map<string, { sum: number; n: number; total: number }>();
  for (const t of pubRows) {
    const s = normalizeSector(t.sector);
    if (!bySector.has(s)) bySector.set(s, { sum: 0, n: 0, total: 0 });
    const b = bySector.get(s)!;
    b.total++;
    if (typeof t.accuracy === 'number') { b.sum += t.accuracy; b.n++; }
  }
  const avgAccuracyBySector = Array.from(bySector.entries())
    .map(([sector, b]) => ({ sector, theses: b.total, accuracy: b.n ? Math.round(b.sum / b.n) : null }))
    .sort((a, b) => b.theses - a.theses);

  // Trending: top 3 (lib/trending.ts), arricchite come gli item della vetrina.
  const top = pickTrending(
    pubRows.map((t) => ({ ...t, recentImports: recentImports.get(t.id) || 0 })),
    3,
  );
  const topUserIds = Array.from(new Set(top.map((t) => t.user_id)));
  const nameByUser = new Map<string, string>();
  const repByUser = new Map<string, { status?: string | null; accuracy?: number | null }[]>();
  if (topUserIds.length) {
    const [{ data: profs }, { data: repRows }] = await Promise.all([
      admin.from('profiles').select('id, display_name').in('id', topUserIds),
      admin.from('theses').select('user_id, status, accuracy').in('user_id', topUserIds),
    ]);
    for (const p of profs || []) if (p.display_name) nameByUser.set(p.id, p.display_name);
    for (const t of repRows || []) {
      if (!repByUser.has(t.user_id)) repByUser.set(t.user_id, []);
      repByUser.get(t.user_id)!.push(t);
    }
  }
  const trending = top.map((t) => ({
    id: t.id,
    thesis: t.thesis,
    confidence: t.confidence,
    status: t.status || 'active',
    accuracy: t.accuracy ?? null,
    sector: normalizeSector(t.sector),
    created_at: t.created_at,
    imports14d: recentImports.get(t.id) || 0,
    author: authorRef(t.user_id),
    authorName: nameByUser.get(t.user_id) || null,
    authorRep: authorRep(repByUser.get(t.user_id) || []),
  }));

  return NextResponse.json(
    {
      stats: {
        publicTheses: pubRows.length,
        activeAuthors: new Set(pubRows.map((t) => t.user_id)).size,
        confirmed: pubRows.filter((t) => t.status === 'confirmed').length,
        avgAccuracyBySector,
      },
      trending,
    },
    // TTL corto: il conteggio "tesi pubbliche" deve riflettere una nuova
    // pubblicazione in secondi, non minuti (prima 60+300 → fino a ~6 min stale).
    { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } },
  );
}

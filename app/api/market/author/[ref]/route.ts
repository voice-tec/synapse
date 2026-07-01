import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { authorRep, authorRef } from '@/lib/reputation';
import { normalizeSector } from '@/lib/sectors';

// Profilo pubblico di un autore, indirizzato per hash opaco (authorRef) e non
// per handle: l'hash è stabile, il display_name è modificabile/cancellabile.
// Privacy: l'hash si risolve SOLO tra gli autori con almeno una tesi pubblica —
// l'hash di un utente che non ha mai pubblicato non è risolvibile (404), e lo
// user_id non compare mai nel payload.
export async function GET(_req: NextRequest, { params }: { params: { ref: string } }) {
  const ref = (params.ref || '').toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(ref)) return NextResponse.json({ error: 'bad_ref' }, { status: 400 });

  const admin = createAdminClient();
  const { data: pubAll, error: pubErr } = await admin
    .from('theses')
    .select('id, user_id, thesis, confidence, explanation, signals, status, accuracy, sector, created_at')
    .eq('is_public', true)
    .limit(1000);
  if (pubErr) return NextResponse.json({ error: 'author_unavailable' }, { status: 500 });

  const uid = Array.from(new Set((pubAll || []).map((t) => t.user_id))).find((u) => authorRef(u) === ref);
  if (!uid) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const theses = (pubAll || []).filter((t) => t.user_id === uid)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const [{ data: prof }, { data: allMine }, { data: clones }, { count: legacyCount }] = await Promise.all([
    admin.from('profiles').select('display_name').eq('id', uid).maybeSingle(),
    // Reputazione su TUTTE le sue tesi (anche private), come in vetrina.
    admin.from('theses').select('status, accuracy').eq('user_id', uid),
    admin.from('theses').select('imported_from_thesis').in('imported_from_thesis', theses.map((t) => t.id)),
    // Fallback legacy: import precedenti alla colonna imported_from_thesis
    // (e import via grafo condiviso) tracciati solo con l'hash autore.
    admin.from('theses').select('id', { count: 'exact', head: true })
      .eq('imported_from_author', ref).is('imported_from_thesis', null),
  ]);

  const importsByThesis = new Map<string, number>();
  for (const c of clones || []) {
    if (c.imported_from_thesis) importsByThesis.set(c.imported_from_thesis, (importsByThesis.get(c.imported_from_thesis) || 0) + 1);
  }
  const importsTracked = Array.from(importsByThesis.values()).reduce((a, b) => a + b, 0);

  const bySector = new Map<string, { sum: number; n: number; total: number }>();
  for (const t of theses) {
    const s = normalizeSector(t.sector);
    if (!bySector.has(s)) bySector.set(s, { sum: 0, n: 0, total: 0 });
    const b = bySector.get(s)!;
    b.total++;
    if (typeof t.accuracy === 'number') { b.sum += t.accuracy; b.n++; }
  }

  const sigText = (arr: any[]) => (arr || []).map((s: any) => (typeof s === 'string' ? s : s?.text)).filter(Boolean);

  return NextResponse.json(
    {
      author: ref,
      name: prof?.display_name || null,
      rep: authorRep(allMine || []),
      // "Attivo da": prima tesi pubblica — nessun dato del profilo esposto.
      memberSince: theses.length ? theses[theses.length - 1].created_at : null,
      importsReceived: importsTracked + (legacyCount || 0),
      bySector: Array.from(bySector.entries())
        .map(([sector, b]) => ({ sector, theses: b.total, accuracy: b.n ? Math.round(b.sum / b.n) : null }))
        .sort((a, b) => b.theses - a.theses),
      theses: theses.map((t) => ({
        id: t.id,
        thesis: t.thesis,
        confidence: t.confidence,
        explanation: t.explanation,
        status: t.status || 'active',
        accuracy: t.accuracy ?? null,
        sector: normalizeSector(t.sector),
        created_at: t.created_at,
        signals: t.signals ? { confirm: sigText(t.signals.confirm), invalidate: sigText(t.signals.invalidate) } : null,
        imports: importsByThesis.get(t.id) || 0,
      })),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}

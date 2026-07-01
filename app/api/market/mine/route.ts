import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { authorRef } from '@/lib/reputation';
import { normalizeSector } from '@/lib/sectors';

// "Le mie pubblicazioni": performance delle proprie tesi pubbliche + import
// ricevuti. Confine RLS/admin: le proprie tesi si leggono come utente (RLS),
// ma i CLONI appartengono ad altri utenti e RLS li nasconderebbe — solo quel
// conteggio passa dal service role. Dati personali: mai in cache CDN.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { data: mine, error } = await supabase
    .from('theses')
    .select('id, thesis, confidence, explanation, status, accuracy, sector, created_at')
    .eq('user_id', user.id)
    .eq('is_public', true)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'mine_unavailable' }, { status: 500 });
  const items = mine || [];

  const admin = createAdminClient();
  const ref = authorRef(user.id);
  const importsByThesis = new Map<string, number>();
  let legacy = 0;
  if (items.length) {
    const [{ data: clones }, { count: legacyCount }] = await Promise.all([
      admin.from('theses').select('imported_from_thesis').in('imported_from_thesis', items.map((t) => t.id)),
      // Import legacy (pre-colonna) e via grafo condiviso: solo hash autore.
      admin.from('theses').select('id', { count: 'exact', head: true })
        .eq('imported_from_author', ref).is('imported_from_thesis', null),
    ]);
    for (const c of clones || []) {
      if (c.imported_from_thesis) importsByThesis.set(c.imported_from_thesis, (importsByThesis.get(c.imported_from_thesis) || 0) + 1);
    }
    legacy = legacyCount || 0;
  }
  const importsTracked = Array.from(importsByThesis.values()).reduce((a, b) => a + b, 0);

  const withAcc = items.filter((t) => typeof t.accuracy === 'number');
  return NextResponse.json(
    {
      author: ref,
      items: items.map((t) => ({
        id: t.id,
        thesis: t.thesis,
        confidence: t.confidence,
        explanation: t.explanation,
        status: t.status || 'active',
        accuracy: t.accuracy ?? null,
        sector: normalizeSector(t.sector),
        created_at: t.created_at,
        imports: importsByThesis.get(t.id) || 0,
      })),
      totals: {
        published: items.length,
        maxPublic: 20,
        imports: importsTracked,
        importsLegacy: legacy,
        confirmed: items.filter((t) => t.status === 'confirmed').length,
        avgAccuracy: withAcc.length
          ? Math.round(withAcc.reduce((a, t) => a + (t.accuracy as number), 0) / withAcc.length)
          : null,
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

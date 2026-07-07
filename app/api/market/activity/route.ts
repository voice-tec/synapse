import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { authorRef } from '@/lib/reputation';

// Strip attività del marketplace: gli ultimi eventi pubblici derivati dai
// dati esistenti (nessuna tabella nuova) — tesi pubblicate, verdetti chiusi,
// import ricevuti. Solo tesi pubbliche; autori come display_name o #hash
// (le stesse identità già esposte in vetrina). Lettura cross-utente → admin.
type Ev = {
  type: 'published' | 'confirmed' | 'invalidated' | 'imported';
  thesisId: string;      // id della tesi PUBBLICA da linkare
  thesis: string;        // snippet
  author: string;        // ref opaco dell'attore (autore o importatore)
  authorName: string | null;
  date: string;
};

const MAX_EVENTS = 12;
const snip = (s: string | null) => (s || '').slice(0, 80);

export async function GET() {
  const admin = createAdminClient();

  const [{ data: pub }, { data: closed }, { data: clones }] = await Promise.all([
    admin.from('theses')
      .select('id, user_id, thesis, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(8),
    admin.from('theses')
      .select('id, user_id, thesis, status, closed_at')
      .eq('is_public', true)
      .not('closed_at', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(5),
    // Import: cloni che puntano a una tesi pubblica; l'importatore resta un
    // hash anonimo (mai il display name: importare non è un atto pubblico).
    admin.from('theses')
      .select('user_id, created_at, imported_from_thesis')
      .not('imported_from_thesis', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const events: Ev[] = [];
  for (const t of pub || []) {
    events.push({ type: 'published', thesisId: t.id, thesis: snip(t.thesis), author: authorRef(t.user_id), authorName: null, date: t.created_at });
  }
  for (const t of closed || []) {
    if (t.status !== 'confirmed' && t.status !== 'invalidated') continue;
    events.push({ type: t.status, thesisId: t.id, thesis: snip(t.thesis), author: authorRef(t.user_id), authorName: null, date: t.closed_at });
  }

  // Titoli delle tesi importate: servono le righe target (solo pubbliche).
  const targetIds = Array.from(new Set((clones || []).map((c) => c.imported_from_thesis).filter(Boolean)));
  const pubTargets = new Map<string, { thesis: string | null }>();
  if (targetIds.length) {
    const { data: targets } = await admin
      .from('theses').select('id, thesis').eq('is_public', true).in('id', targetIds);
    for (const t of targets || []) pubTargets.set(t.id, t);
  }
  for (const c of clones || []) {
    const target = c.imported_from_thesis ? pubTargets.get(c.imported_from_thesis) : null;
    if (!target) continue;
    events.push({ type: 'imported', thesisId: c.imported_from_thesis, thesis: snip(target.thesis), author: authorRef(c.user_id), authorName: null, date: c.created_at });
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const top = events.slice(0, MAX_EVENTS);

  // Nomi pubblici degli attori (una query sola). L'importatore resta #hash.
  const uidByRef = new Map<string, string>();
  for (const t of (pub || []).concat((closed || []) as any[])) uidByRef.set(authorRef(t.user_id), t.user_id);
  const uids = Array.from(new Set(top.filter((e) => e.type !== 'imported').map((e) => uidByRef.get(e.author)).filter(Boolean))) as string[];
  if (uids.length) {
    const { data: profs } = await admin.from('profiles').select('id, display_name').in('id', uids);
    const nameByRef = new Map<string, string>();
    for (const p of profs || []) if (p.display_name) nameByRef.set(authorRef(p.id), p.display_name);
    for (const e of top) if (e.type !== 'imported') e.authorName = nameByRef.get(e.author) || null;
  }

  return NextResponse.json(
    { events: top },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}

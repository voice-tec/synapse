import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { extractTickers } from '@/lib/market-tickers';
import { authorRep, authorRef } from '@/lib/reputation';
import { normalizeSector } from '@/lib/sectors';

// Sezione "Per te" della home marketplace: tesi pubbliche di ALTRI utenti che
// toccano i ticker dell'utente (portafoglio + segnali delle sue tesi). Dati
// propri via client RLS; tesi pubbliche altrui via admin (come la vetrina).
// Escluse le tesi già importate: la sezione deve proporre roba nuova.
// Item nello stesso formato della vetrina (riusa la stessa card).
// Dato personale: mai in cache.
const MAX_ITEMS = 12;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const noStore = { 'Cache-Control': 'private, no-store' };

  const [{ data: prof }, { data: mine }] = await Promise.all([
    supabase.from('profiles').select('portfolio').eq('id', user.id).single(),
    supabase.from('theses').select('signals, imported_from_thesis').eq('user_id', user.id),
  ]);

  const myTickers = new Set<string>();
  for (const h of ((Array.isArray(prof?.portfolio) ? prof!.portfolio : []) as any[])) {
    const tk = h?.ticker ? String(h.ticker).toUpperCase().trim() : '';
    if (tk) myTickers.add(tk);
  }
  for (const t of mine || []) {
    for (const tk of extractTickers(t.signals)) myTickers.add(tk);
  }
  if (!myTickers.size) return NextResponse.json({ items: [] }, { headers: noStore });

  const importedIds = new Set((mine || []).map((t) => t.imported_from_thesis).filter(Boolean));

  const admin = createAdminClient();
  const { data: pub, error } = await admin
    .from('theses')
    .select('id, user_id, thesis, confidence, explanation, signals, status, accuracy, created_at, updated_at, sector')
    .eq('is_public', true)
    .neq('user_id', user.id)
    .limit(1000);
  if (error) return NextResponse.json({ error: 'forme_unavailable' }, { status: 500 });

  // Match sui ticker; ordinati per numero di ticker in comune, poi freschezza.
  const matched = (pub || [])
    .filter((t) => !importedIds.has(t.id))
    .map((t) => ({ t, hit: extractTickers(t.signals).filter((tk) => myTickers.has(tk)) }))
    .filter((x) => x.hit.length > 0)
    .sort((a, b) =>
      (b.hit.length - a.hit.length) ||
      (new Date(b.t.updated_at || b.t.created_at).getTime() - new Date(a.t.updated_at || a.t.created_at).getTime()),
    )
    .slice(0, MAX_ITEMS);
  if (!matched.length) return NextResponse.json({ items: [] }, { headers: noStore });

  // Arricchimento come in vetrina: reputazione/nome autore + import/fork.
  const uids = Array.from(new Set(matched.map((x) => x.t.user_id)));
  const ids = matched.map((x) => x.t.id);
  const [{ data: repRows }, { data: profs }, { data: clones }] = await Promise.all([
    admin.from('theses').select('user_id, status, accuracy').in('user_id', uids),
    admin.from('profiles').select('id, display_name').in('id', uids),
    admin.from('theses').select('imported_from_thesis, is_public').in('imported_from_thesis', ids),
  ]);
  const byUser = new Map<string, { status?: string | null; accuracy?: number | null }[]>();
  for (const r of repRows || []) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }
  const nameByUser = new Map<string, string>();
  for (const p of profs || []) if (p.display_name) nameByUser.set(p.id, p.display_name);
  const counts = new Map<string, number>();
  const forkCounts = new Map<string, number>();
  for (const c of clones || []) {
    if (!c.imported_from_thesis) continue;
    counts.set(c.imported_from_thesis, (counts.get(c.imported_from_thesis) || 0) + 1);
    if (c.is_public) forkCounts.set(c.imported_from_thesis, (forkCounts.get(c.imported_from_thesis) || 0) + 1);
  }

  const sigText = (arr: any[]) => (arr || []).map((s: any) => (typeof s === 'string' ? s : s?.text)).filter(Boolean);
  const items = matched.map(({ t, hit }) => ({
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
    imports: counts.get(t.id) || 0,
    forks: forkCounts.get(t.id) || 0,
    matchedTickers: hit,
  }));

  return NextResponse.json({ items }, { headers: noStore });
}

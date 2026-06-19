import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { authorRep, authorRef } from '@/lib/reputation';

// Vetrina marketplace: tesi pubbliche di tutti gli utenti, con la reputazione
// (anonima) dell'autore. Lettura cross-utente → service role (RLS bloccherebbe).
// Autore non identificato: solo un riferimento opaco (hash) per raggruppare le
// tesi dello stesso autore senza esporne l'identità.
export async function GET() {
  const admin = createAdminClient();
  const { data: all } = await admin
    .from('theses')
    .select('id, user_id, thesis, confidence, explanation, signals, status, accuracy, created_at, is_public');

  const rows = all || [];
  // Reputazione per autore su tutte le sue tesi.
  const byUser = new Map<string, any[]>();
  for (const t of rows) {
    if (!byUser.has(t.user_id)) byUser.set(t.user_id, []);
    byUser.get(t.user_id)!.push(t);
  }

  // Nome pubblico opt-in degli autori con almeno una tesi pubblica.
  const pubUserIds = Array.from(new Set(rows.filter((t) => t.is_public).map((t) => t.user_id)));
  const nameByUser = new Map<string, string>();
  if (pubUserIds.length) {
    const { data: profs } = await admin
      .from('profiles').select('id, display_name').in('id', pubUserIds);
    for (const p of profs || []) if (p.display_name) nameByUser.set(p.id, p.display_name);
  }

  const sigText = (arr: any[]) => (arr || []).map((s: any) => (typeof s === 'string' ? s : s?.text)).filter(Boolean);

  const items = rows
    .filter((t) => t.is_public)
    .map((t) => ({
      id: t.id,
      thesis: t.thesis,
      confidence: t.confidence,
      explanation: t.explanation,
      status: t.status || 'active',
      created_at: t.created_at,
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
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}

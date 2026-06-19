import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { wordOverlap } from '@/lib/text';
import { randomBytes } from 'crypto';

// Importa una tesi vista in un grafo condiviso (/g/[token]) nel proprio grafo,
// come NUOVA tesi con track record azzerato: i segnali dell'autore vengono
// copiati senza fired/checked_at e ri-valutati da /api/refresh sui dati e sulle
// date dell'importatore (copiare l'accuratezza altrui sarebbe privo di senso).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { token, clusterId } = await req.json();
  if (!token || typeof token !== 'string' || token.length > 64 || !clusterId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // Snapshot via service role (la tabella non è leggibile da altri utenti).
  const admin = createAdminClient();
  const { data: shared } = await admin
    .from('shared_graphs')
    .select('snapshot, user_id')
    .eq('token', token)
    .maybeSingle();
  if (!shared) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (shared.user_id === user.id) {
    return NextResponse.json({ error: 'own_graph' }, { status: 400 });
  }

  const src = (shared.snapshot?.theses || []).find((t: any) => t.clusterId === clusterId);
  if (!src?.thesis) return NextResponse.json({ error: 'thesis_not_found' }, { status: 404 });

  // Dedup vs le tesi del chiamante.
  const { data: mine } = await supabase.from('theses').select('id, thesis').eq('user_id', user.id);
  const dup = (mine || []).find(
    (m: any) => m.thesis === src.thesis || wordOverlap(m.thesis || '', src.thesis) >= 0.55,
  );
  if (dup) return NextResponse.json({ duplicate: true, thesis_id: dup.id });

  // Segnali freschi: si copia solo il predicato, mai lo stato di valutazione.
  const stripDir = (arr: any[]) =>
    (arr || []).map((s: any) => ({
      text: s.text ?? null,
      kind: s.kind ?? 'manual',
      metric: s.metric ?? null,
      op: s.op ?? null,
      threshold: s.threshold ?? null,
    }));
  const signals = src.signals
    ? { confirm: stripDir(src.signals.confirm), invalidate: stripDir(src.signals.invalidate) }
    : null;

  const { data: inserted, error } = await supabase
    .from('theses')
    .insert({
      user_id: user.id,
      cluster_id: 'imp_' + randomBytes(6).toString('base64url'),
      thesis: src.thesis,
      confidence: src.confidence ?? 50,
      explanation: src.explanation ?? null,
      signals,
      source_task_ids: [],
      history: [],
      status: 'active',
      accuracy: null,
      signals_hit: 0,
      signals_total: 0,
      color: src.color || '#a78bfa',
      imported_from_token: token,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: true, thesis_id: inserted.id });
}

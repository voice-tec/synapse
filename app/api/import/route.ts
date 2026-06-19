import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { wordOverlap } from '@/lib/text';
import { randomBytes } from 'crypto';

// Importa una tesi nel proprio grafo come NUOVA tesi con track record azzerato:
// si copiano solo i predicati (segnali senza fired/checked_at), accuracy null e
// created_at oggi, così /api/refresh li ri-valuta sui dati e sulle date
// dell'importatore (l'accuratezza dell'autore, ancorata alle SUE date, sarebbe
// fuorviante). Due sorgenti:
//  - { thesisId }        → una tesi pubblica del marketplace
//  - { token, clusterId} → una tesi vista in un grafo condiviso /g/[token]
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { token, clusterId, thesisId } = await req.json();
  const admin = createAdminClient();

  // Risolvi la tesi sorgente + il suo proprietario.
  let src: any = null;
  let ownerId: string | null = null;
  if (thesisId) {
    const { data: th } = await admin
      .from('theses')
      .select('user_id, thesis, confidence, explanation, signals, color, is_public')
      .eq('id', thesisId)
      .maybeSingle();
    if (!th || !th.is_public) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    src = th; ownerId = th.user_id;
  } else if (token && clusterId) {
    if (typeof token !== 'string' || token.length > 64) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    const { data: shared } = await admin
      .from('shared_graphs').select('snapshot, user_id').eq('token', token).maybeSingle();
    if (!shared) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    src = (shared.snapshot?.theses || []).find((t: any) => t.clusterId === clusterId);
    ownerId = shared.user_id;
  } else {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!src?.thesis) return NextResponse.json({ error: 'thesis_not_found' }, { status: 404 });
  if (ownerId === user.id) return NextResponse.json({ error: 'own_thesis' }, { status: 400 });

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
      imported_from_token: token || null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: true, thesis_id: inserted.id });
}

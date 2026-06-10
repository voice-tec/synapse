import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

// Crea/aggiorna lo snapshot pubblico del grafo dell'utente.
// Un solo link per utente (stabile): ri-condividere aggiorna la fotografia.
// Lo snapshot è costruito QUI dai dati in DB, non fidandosi del client.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const [{ data: tasks }, { data: conns }, { data: theses }, { data: actions }] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('connections').select('*').eq('user_id', user.id),
    supabase.from('theses').select('*').eq('user_id', user.id),
    supabase.from('actions').select('*').eq('user_id', user.id),
  ]);

  if (!tasks?.length) {
    return NextResponse.json({ error: 'empty_graph' }, { status: 400 });
  }

  // Snapshot snello: solo ciò che la pagina pubblica mostra
  const snapshot = {
    tasks: tasks.map((t) => ({
      id: t.id,
      q: t.raw_query,
      type: t.intent?.analysis_type || null,
      hyp: t.fingerprint?.hypothesis || null,
      sector: t.fingerprint?.sector || null,
      insight: t.output?.insight || null,
      metrics: (t.output?.metrics || []).slice(0, 3),
    })),
    conns: (conns || []).map((c) => ({ from: c.task_from, to: c.task_to, type: c.type, score: c.score })),
    theses: (theses || []).map((th) => ({
      id: th.id,
      thesis: th.thesis,
      confidence: th.confidence,
      explanation: th.explanation,
      signals: th.signals || null,
      sources: th.source_task_ids || [],
      color: th.color || '#a78bfa',
      revisions: Array.isArray(th.history) ? Math.max(0, th.history.length - 1) : 0,
      clusterId: th.cluster_id,
    })),
    actions: (actions || []).map((a) => ({
      id: a.id,
      clusterId: a.cluster_id,
      title: a.title,
      summary: a.summary,
      categories: (a.categories || []).map((c: any) => ({
        name: c.name,
        weight_hint: c.weight_hint || null,
        examples: (c.examples || []).map((ex: any) => ({ name: ex.name, ticker: ex.ticker || null })),
      })),
      performance: a.performance || null,
    })),
  };

  // Token stabile: riusa quello esistente se l'utente ha già condiviso
  const { data: existing } = await supabase
    .from('shared_graphs')
    .select('token')
    .eq('user_id', user.id)
    .maybeSingle();
  const token = existing?.token || randomBytes(9).toString('base64url');

  const { error } = await supabase.from('shared_graphs').upsert(
    { user_id: user.id, token, snapshot, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ path: `/g/${token}` });
}

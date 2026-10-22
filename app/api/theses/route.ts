import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { validateRevision, signalPredicates } from '@/lib/thesis-card';

export async function GET(req: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const cluster = req.nextUrl.searchParams.get('cluster');
  if (!cluster || cluster.length > 200) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { data: thesis, error } = await db.from('theses').select('*').eq('user_id', user.id).eq('cluster_id', cluster).maybeSingle();
  if (error) return NextResponse.json({ error: 'card_unavailable' }, { status: 503 });
  if (!thesis) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { data: versions, error: ve } = await db.from('thesis_versions').select('revision,recorded_at,reason,snapshot').eq('user_id', user.id).eq('thesis_id', thesis.id).order('revision', { ascending: false });
  if (ve) return NextResponse.json({ error: 'migration_required' }, { status: 503 });
  return NextResponse.json({ thesis, versions }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let input: any, patch: any;
  try { input = await req.json(); patch = validateRevision(input); }
  catch { return NextResponse.json({ error: 'invalid_revision' }, { status: 400 }); }
  if (!/^[0-9a-f-]{36}$/i.test(input.id || '')) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { data, error } = await db.rpc('revise_thesis', { p_id: input.id, p_revision: input.revision, p_patch: patch });
  if (error) return NextResponse.json({ error: error.code === '40001' ? 'revision_conflict' : error.code === 'P0002' ? 'not_found' : 'revision_failed' }, { status: error.code === '40001' ? 409 : error.code === 'P0002' ? 404 : 400 });
  return NextResponse.json({ thesis: data });
}

// Persistenza del clustering esistente: whitelist, identità server e CAS.
export async function POST(req: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const m = await req.json().catch(() => null);
  if (!m || typeof m.clusterId !== 'string' || m.clusterId.length > 200 || typeof m.thesis !== 'string' || !m.thesis.trim() || m.thesis.length > 4000 || !Array.isArray(m.source_ids) || m.source_ids.length > 100) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { data: old, error: readError } = await db.from('theses').select('*').eq('user_id', user.id).eq('cluster_id', m.clusterId).maybeSingle();
  if (readError) return NextResponse.json({ error: 'save_failed' }, { status: 503 });
  if (old && m.revision !== old.revision) return NextResponse.json({ error: 'revision_conflict' }, { status: 409 });
  const signals = signalPredicates(m.signals);
  const changed = !old || old.thesis !== m.thesis || old.explanation !== m.explanation || JSON.stringify(signalPredicates(old.signals)) !== JSON.stringify(signals) || JSON.stringify(old.source_task_ids) !== JSON.stringify(m.source_ids);
  const payload: any = {
    user_id: user.id, cluster_id: m.clusterId, thesis: m.thesis,
    confidence: Number.isFinite(m.confidence) ? Math.max(0, Math.min(100, Math.round(m.confidence))) : 50,
    explanation: typeof m.explanation === 'string' ? m.explanation.slice(0,4000) : null,
    pattern: typeof m.pattern === 'string' ? m.pattern.slice(0,4000) : null,
    suggested_question: typeof m.suggested_question === 'string' ? m.suggested_question.slice(0,2000) : null,
    sector: typeof m.sector === 'string' ? m.sector.slice(0,100) : null,
    source_task_ids: m.source_ids, color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#a78bfa',
    pos_x: Number.isFinite(m.x) ? m.x : null, pos_y: Number.isFinite(m.y) ? m.y : null,
    revision_reason: 'memory_update',
  };
  if (changed) Object.assign(payload, { signals, status: 'active', accuracy: null, signals_hit: 0, signals_total: 0, closed_at: null });
  const admin = createAdminClient();
  const result = old
    ? await admin.from('theses').update(payload).eq('id', old.id).eq('user_id', user.id).eq('revision', old.revision).select().maybeSingle()
    : await admin.from('theses').insert(payload).select().single();
  if (result.error) return NextResponse.json({ error: 'save_failed' }, { status: 400 });
  if (!result.data) return NextResponse.json({ error: 'revision_conflict' }, { status: 409 });
  return NextResponse.json({ thesis: result.data });
}

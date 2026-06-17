import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// "Avvisami se cambia": l'utente mette sotto osservazione il verdetto di una
// task. Il cron /api/cron/recheck lo ri-valuta periodicamente; se il verdetto
// flippa, il flip viene salvato qui e mostrato come notifica al prossimo load.

const WATCH_LIMITS: Record<string, number> = { free: 2, pro: 30, team: 30 };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { data, error } = await supabase
    .from('watches')
    .select('id, task_id, query, last_stance, last_checked_at, flip, flip_seen, active')
    .eq('user_id', user.id)
    .eq('active', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watches: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { task_id } = await req.json();
  if (!task_id) return NextResponse.json({ error: 'task_id mancante' }, { status: 400 });

  // La task deve esistere ed essere dell'utente (RLS lo garantisce comunque)
  const { data: task } = await supabase
    .from('tasks')
    .select('id, raw_query, output')
    .eq('id', task_id)
    .single();
  if (!task) return NextResponse.json({ error: 'Task non trovata' }, { status: 404 });

  const { data: profile } = await supabase
    .from('profiles').select('plan').eq('id', user.id).single();
  const plan = profile?.plan || 'free';
  const limit = WATCH_LIMITS[plan] ?? 2;

  const { count } = await supabase
    .from('watches')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('active', true);
  if ((count || 0) >= limit) {
    return NextResponse.json({ error: 'watch_limit', limit, plan }, { status: 429 });
  }

  const verdict = (task.output as any)?.verdict || {};
  // Watch ha senso solo se c'è un verdetto da osservare: senza stance il
  // recheck non può rilevare un flip (resterebbe un avviso morto che brucia
  // il limite del piano).
  if (!verdict.stance) {
    return NextResponse.json({ error: 'no_verdict' }, { status: 400 });
  }

  const { data: watch, error } = await supabase
    .from('watches')
    .upsert({
      user_id: user.id,
      task_id,
      query: task.raw_query,
      last_stance: verdict.stance || null,
      last_label: verdict.label || null,
      last_confidence: verdict.confidence || null,
      last_checked_at: new Date().toISOString(),
      active: true,
      flip: null,
      flip_seen: false,
    }, { onConflict: 'user_id,task_id' })
    .select('id, task_id, query, last_stance, flip, flip_seen, active')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watch });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  // Segna il flip come visto (la notifica non riappare ai load successivi)
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id mancante' }, { status: 400 });
  const { error } = await supabase
    .from('watches')
    .update({ flip_seen: true })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { task_id } = await req.json();
  if (!task_id) return NextResponse.json({ error: 'task_id mancante' }, { status: 400 });
  const { error } = await supabase
    .from('watches')
    .delete()
    .eq('user_id', user.id)
    .eq('task_id', task_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// Pubblica/ritira una propria tesi dal marketplace (opt-in per tesi).
// Anti-spam in pubblicazione: confidence minima, tetto di tesi pubbliche, e
// niente ripubblicazione di tesi a loro volta importate (no ricircolo).
// RLS garantisce che si tocchi solo una tesi del chiamante.
const MIN_PUBLISH_CONF = 60;
const MAX_PUBLIC = 20;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { clusterId, public: isPublic } = await req.json();
  if (!clusterId || typeof isPublic !== 'boolean') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { data: th } = await supabase
    .from('theses')
    .select('id, confidence, imported_from_token, imported_from_author, is_public')
    .eq('user_id', user.id)
    .eq('cluster_id', clusterId)
    .maybeSingle();
  if (!th) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (isPublic) {
    if (th.imported_from_token || th.imported_from_author) {
      return NextResponse.json({ error: 'imported_no_republish' }, { status: 400 });
    }
    if ((th.confidence ?? 0) < MIN_PUBLISH_CONF) {
      return NextResponse.json({ error: 'low_confidence', min: MIN_PUBLISH_CONF }, { status: 400 });
    }
    if (!th.is_public) {
      const { count } = await supabase
        .from('theses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_public', true);
      if ((count ?? 0) >= MAX_PUBLIC) {
        return NextResponse.json({ error: 'limit_reached', max: MAX_PUBLIC }, { status: 400 });
      }
    }
  }

  const { error } = await supabase.from('theses').update({ is_public: isPublic }).eq('id', th.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, public: isPublic });
}

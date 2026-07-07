import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { wordOverlap } from '@/lib/text';
import { signalsPredicatesEqual } from '@/lib/fork';

// Pubblica/ritira una propria tesi dal marketplace (opt-in per tesi).
// Anti-spam in pubblicazione: confidence minima, tetto di tesi pubbliche.
// Le tesi importate dal marketplace sono ripubblicabili come FORK solo se
// modificate rispetto all'origine (testo o predicati dei segnali) — copiare
// una tesi buona e ripubblicarla identica per rubarne la reputazione resta
// impossibile. Import da grafo condiviso / origine cancellata: nessuna origine
// da diffare → non ripubblicabile come prima.
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

  const { data: th, error: thErr } = await supabase
    .from('theses')
    .select('id, thesis, signals, confidence, imported_from_token, imported_from_author, imported_from_thesis, is_public')
    .eq('user_id', user.id)
    .eq('cluster_id', clusterId)
    .maybeSingle();
  if (thErr) return NextResponse.json({ error: thErr.message }, { status: 500 });
  if (!th) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (isPublic) {
    if (th.imported_from_thesis) {
      // Fork: confronto con l'origine (lettura cross-utente → admin).
      const { data: origin } = await createAdminClient()
        .from('theses').select('thesis, signals')
        .eq('id', th.imported_from_thesis).maybeSingle();
      if (!origin) return NextResponse.json({ error: 'imported_no_republish' }, { status: 400 });
      const unchanged =
        wordOverlap(th.thesis || '', origin.thesis || '') >= 0.9 &&
        signalsPredicatesEqual(th.signals, origin.signals);
      if (unchanged) return NextResponse.json({ error: 'fork_unchanged' }, { status: 400 });
    } else if (th.imported_from_token || th.imported_from_author) {
      return NextResponse.json({ error: 'imported_no_republish' }, { status: 400 });
    }
    if ((th.confidence ?? 0) < MIN_PUBLISH_CONF) {
      return NextResponse.json({ error: 'low_confidence', min: MIN_PUBLISH_CONF }, { status: 400 });
    }
    // Handle obbligatorio: niente tesi pubbliche anonime senza nome pubblico.
    const { data: prof, error: profErr } = await supabase
      .from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    if (!prof?.display_name || !prof.display_name.trim()) {
      return NextResponse.json({ error: 'no_handle' }, { status: 400 });
    }
    if (!th.is_public) {
      const { count, error: cntErr } = await supabase
        .from('theses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_public', true);
      if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 500 });
      if ((count ?? 0) >= MAX_PUBLIC) {
        return NextResponse.json({ error: 'limit_reached', max: MAX_PUBLIC }, { status: 400 });
      }
    }
  }

  const { error } = await supabase
    .from('theses').update({ is_public: isPublic })
    .eq('id', th.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, public: isPublic });
}

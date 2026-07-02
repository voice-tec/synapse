import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// Id delle tesi del marketplace già importate dal chiamante: alimenta il
// badge "già nel tuo grafo" sulle card. Solo righe proprie → client RLS,
// niente admin. Dato personale: mai in cache.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { data, error } = await supabase
    .from('theses')
    .select('imported_from_thesis')
    .eq('user_id', user.id)
    .not('imported_from_thesis', 'is', null);
  if (error) return NextResponse.json({ error: 'imported_unavailable' }, { status: 500 });

  const ids = Array.from(new Set((data || []).map((r) => r.imported_from_thesis).filter(Boolean)));
  return NextResponse.json({ ids }, { headers: { 'Cache-Control': 'private, no-store' } });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// Pubblica/ritira una propria tesi dal marketplace (opt-in per tesi).
// RLS garantisce che si aggiorni solo una tesi del chiamante.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { clusterId, public: isPublic } = await req.json();
  if (!clusterId || typeof isPublic !== 'boolean') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { error } = await supabase
    .from('theses')
    .update({ is_public: isPublic })
    .eq('user_id', user.id)
    .eq('cluster_id', clusterId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, public: isPublic });
}

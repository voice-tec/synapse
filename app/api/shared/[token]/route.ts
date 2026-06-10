import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// Lettura pubblica dello snapshot per token. Passa dal service role
// (la tabella non ha policy di lettura anonima: i token non sono enumerabili,
// chi non ha il link non legge niente).
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token || token.length > 64) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('shared_graphs')
    .select('snapshot, title, updated_at')
    .eq('token', token)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json(
    { snapshot: data.snapshot, title: data.title, updated_at: data.updated_at },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } }
  );
}

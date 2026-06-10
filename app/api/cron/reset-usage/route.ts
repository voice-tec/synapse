import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// Vercel cron — primo giorno del mese (vedi vercel.json).
// Azzera i contatori mensili di tutti gli utenti.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ tasks_this_month: 0, ai_calls_this_month: 0 })
    .gte('created_at', '1970-01-01'); // filtro sempre vero: supabase-js rifiuta update senza where

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

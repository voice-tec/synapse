import { createClient } from '@supabase/supabase-js';

// Client con service role — bypassa RLS. SOLO per i cron job server-side,
// mai importare in codice raggiungibile da richieste utente.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

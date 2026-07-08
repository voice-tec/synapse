import { createClient } from '@supabase/supabase-js';

// Client con service role — bypassa RLS. SOLO per i cron job server-side,
// mai importare in codice raggiungibile da richieste utente.
// cache:'no-store': supabase-js legge via fetch GET e Next li mette in Data
// Cache nelle route senza input request-dipendenti (stats/activity servivano
// righe congelate a un vecchio stato del DB, anche tra deploy).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) },
    }
  );
}

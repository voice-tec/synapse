import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Mai Data Cache di Next sulle letture Supabase: dati utente, sempre live
      // (stesso motivo del client admin — vedi lib/supabase-admin.ts).
      global: { fetch: (url: any, opts: any) => fetch(url, { ...opts, cache: 'no-store' }) },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore, middleware handles refresh
          }
        },
      },
    }
  );
}

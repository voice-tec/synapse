import { createAdminClient } from '@/lib/supabase-admin';
// Metering per le chiamate AI "accessorie" (memory, suggest, portfolio, challenge).
// Contatore separato da tasks_this_month: queste chiamate partono anche in
// automatico dalla UI, contarle nel budget task le farebbe pagare doppio.

export const AI_CALL_LIMITS: Record<string, number> = {
  free: 50,    // 50 chiamate al mese
  pro: 500,    // accessorie (suggest/memory/challenge/portfolio/seed)
  team: 500,
};

export async function reserveUsage(userId: string, kind: 'analysis' | 'ai') {
  const { data, error } = await createAdminClient().rpc('reserve_usage', { p_user: userId, p_kind: kind });
  if (error || !data) throw new Error('usage_unavailable');
  return data as { allowed: boolean; used: number; limit: number; plan: string };
}
export async function checkAiCall(_supabase: any, userId: string) {
  return reserveUsage(userId, 'ai');
}
// Compatibilità con i chiamanti: la quota è già prenotata atomicamente.
export async function bumpAiCall(_supabase: any, _userId: string, _used: number) {}

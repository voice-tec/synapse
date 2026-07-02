// Metering per le chiamate AI "accessorie" (memory, suggest, portfolio, challenge).
// Contatore separato da tasks_this_month: queste chiamate partono anche in
// automatico dalla UI, contarle nel budget task le farebbe pagare doppio.

export const AI_CALL_LIMITS: Record<string, number> = {
  free: 50,    // 50 chiamate al mese
  pro: 500,    // accessorie (suggest/memory/challenge/portfolio/seed)
  team: 500,
};

export async function checkAiCall(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, ai_calls_this_month')
    .eq('id', userId)
    .single();

  const plan = profile?.plan || 'free';
  const used = profile?.ai_calls_this_month || 0;
  const limit = AI_CALL_LIMITS[plan] ?? AI_CALL_LIMITS.free;
  return { allowed: used < limit, used, limit, plan };
}

export async function bumpAiCall(supabase: any, userId: string, used: number) {
  await supabase
    .from('profiles')
    .update({ ai_calls_this_month: used + 1 })
    .eq('id', userId);
}

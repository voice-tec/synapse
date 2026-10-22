// Contratto della scheda: i campi finanziari calcolati non sono editabili.
export const CARD_FIELDS = ['thesis', 'explanation', 'sector', 'investment_horizon', 'evaluation_deadline', 'benchmark', 'success_condition', 'invalidation_conditions', 'workflow_state', 'reason'] as const;
export function validateRevision(input: any) {
  if (!input || typeof input !== 'object' || !Number.isInteger(input.revision) || input.revision < 1) throw new Error('invalid_revision');
  const patch: any = {};
  for (const key of CARD_FIELDS) {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > (key === 'reason' ? 1000 : 4000)) throw new Error('invalid_revision');
    patch[key] = value.trim();
  }
  if (!patch.thesis || !patch.reason) throw new Error('invalid_revision');
  if (!['researching', 'monitoring', 'review_needed', 'archived'].includes(patch.workflow_state)) throw new Error('invalid_workflow');
  if (patch.evaluation_deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(patch.evaluation_deadline) || !Number.isFinite(Date.parse(patch.evaluation_deadline)) || new Date(patch.evaluation_deadline).toISOString().slice(0,10) !== patch.evaluation_deadline)) throw new Error('invalid_deadline');
  if (!Array.isArray(input.assets) || input.assets.length > 30 || input.assets.some((s: any) => typeof s !== 'string' || !s.trim() || s.length > 80)) throw new Error('invalid_assets');
  patch.assets = Array.from(new Set(input.assets.map((s: string) => s.trim())));
  return patch;
}

export function signalPredicates(signals: any) {
  const strip = (arr: any) => (Array.isArray(arr) ? arr : []).slice(0, 30).map((raw: any) => {
    const s = typeof raw === 'string' ? { text: raw, kind: 'manual' } : raw || {};
    return { text: s.text ?? null, kind: s.kind ?? 'manual', metric: s.metric ?? null,
      field: s.field ?? null, op: s.op ?? null, threshold: s.threshold ?? null };
  });
  return { confirm: strip(signals?.confirm), invalidate: strip(signals?.invalidate) };
}

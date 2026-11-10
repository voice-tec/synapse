import { createHmac, timingSafeEqual } from 'node:crypto';
import { signalPredicates } from './thesis-card';

// Firma con separazione di dominio; non richiede nuove credenziali di produzione.
// Il client può trasportare l'evidenza, non modificarne i campi di ricerca.
function mac(payload: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('evidence_unavailable');
  return createHmac('sha256', key).update('synapse:thesis-evidence:v1:').update(payload).digest();
}
export function signThesisEvidence(userId: string, cluster: any): string {
  const payload = Buffer.from(JSON.stringify({
    user: userId, thesis: cluster.thesis,
    confidence: Number.isFinite(cluster.confidence) ? Math.max(0, Math.min(100, Math.round(cluster.confidence))) : 50,
    signals: signalPredicates(cluster.signals), expires: Date.now() + 60 * 60 * 1000,
  })).toString('base64url');
  return `${payload}.${mac(payload).toString('base64url')}`;
}
export function verifyThesisEvidence(token: unknown, userId: string, thesis: string): { confidence: number; signals: any } | null {
  if (typeof token !== 'string' || token.length > 100000) return null;
  try {
    const parts = token.split('.'); if (parts.length !== 2) return null;
    const supplied = Buffer.from(parts[1], 'base64url'), expected = mac(parts[0]);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (data.user !== userId || data.thesis !== thesis || !Number.isFinite(data.expires) || data.expires <= Date.now()) return null;
    return { confidence: data.confidence, signals: data.signals };
  } catch { return null; }
}

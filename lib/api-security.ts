import { NextRequest, NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(public status: number, public code: string, public retryAfter?: number) { super(code); }
}
// Restituisce solo codici controllati: mai messaggi di DB/provider o payload utente.
export function safeRoute<T extends any[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try { return await handler(...args); }
    catch (error) {
      if (error instanceof ApiError) return NextResponse.json({ error: error.code }, {
        status: error.status,
        headers: error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined,
      });
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
  };
}
const MAX_BYTES = 262144;
export const isUUID = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
// Limite reale sullo stream, anche per richieste chunked senza Content-Length.
export async function readBody(req: NextRequest, kind: string): Promise<any> {
  if (Number(req.headers.get('content-length')) > MAX_BYTES) throw new ApiError(413, 'payload_too_large');
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); throw new ApiError(413, 'payload_too_large'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body: any;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes) || (['seed','refresh'].includes(kind) ? '{}' : '')); }
  catch { throw new ApiError(400, 'bad_request'); }
  const bad = () => { throw new ApiError(400, 'bad_request'); };
  if (!body || typeof body !== 'object' || Array.isArray(body)) bad();
  const string = (key: string, max: number, required = false) => {
    const v = body[key];
    if (v == null && !required) return;
    if (typeof v !== 'string' || v.length > max || (required && !v.trim())) bad();
  };
  string('lang', 10);
  if (kind === 'analyze') { string('query', 4000, true); string('priorContext', 50000); }
  if (kind === 'suggest') string('userMsg', 50000, true);
  if (kind === 'challenge' || kind === 'portfolio') {
    string('thesis', 4000, true); string('explanation', 10000); string('pattern', 10000); string('clusterId', 200);
  }
  if (kind === 'memory') {
    string('summary', 100000, true);
    if (!Number.isInteger(body.taskCount) || body.taskCount < 0 || body.taskCount > 10000) bad();
    if (body.theses != null && (!Array.isArray(body.theses) || body.theses.length > 100 || body.theses.some((t: any) =>
      !t || typeof t.id !== 'string' || t.id.length > 200 || typeof t.thesis !== 'string' || t.thesis.length > 4000 || !Number.isFinite(t.confidence)))) bad();
  }
  if (kind === 'watch') {
    const key = req.method === 'PATCH' ? 'id' : 'task_id';
    if (!isUUID(body[key])) bad();
  }
  if (kind === 'publish') { string('clusterId', 200, true); if (typeof body.public !== 'boolean') bad(); }
  if (kind === 'import') {
    string('token', 200); string('clusterId', 200);
    if (body.thesisId != null && !isUUID(body.thesisId)) bad();
    if (!body.thesisId && !(body.token && body.clusterId)) bad();
  }
  if (kind === 'theses' && req.method === 'POST') {
    string('clusterId', 200, true); string('thesis', 4000, true);
    if (!Array.isArray(body.source_ids) || body.source_ids.length > 100 || body.source_ids.some((id: unknown) => !isUUID(id))) bad();
  }
  return body;
}

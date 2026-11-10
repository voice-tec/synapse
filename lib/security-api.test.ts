import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ calls: 0, reservations: 0, fail: false, unavailable: false, limited: false }));
vi.mock('./supabase-server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) } }) }));
vi.mock('./supabase-admin', () => ({ createAdminClient: () => ({ rpc: async () => { state.reservations++; return state.limited ? { data: { allowed: false, reason: 'rate_limited', retry_after: 17 } } : state.unavailable ? { error: { message: 'private database detail' } } : { data: { allowed: true, used: 1, limit: 50, plan: 'free' } }; } }) }));
vi.mock('./anthropic', () => ({ askClaudeJSON: async () => { state.calls++; if (state.fail) throw new Error('secret provider detail'); return { json: { questions: [] } }; } }));
import { POST } from '../app/api/suggest/route';
const request = (body: string) => new NextRequest('http://localhost/api/suggest', { method: 'POST', body });
beforeEach(() => Object.assign(state, { calls: 0, reservations: 0, fail: false, unavailable: false, limited: false }));
describe('AI API security boundary', () => {
 it.each(['null', '[]', '{', '{}', '{"userMsg":42}', JSON.stringify({ userMsg: 'x'.repeat(50001) })])('rejects malformed input before consuming quota (case %#)', async body => {
  const response = await POST(request(body));
  expect(response.status).toBe(400); expect(state.calls).toBe(0); expect(state.reservations).toBe(0);
 });
 it('bounds bytes even without Content-Length', async () => {
  const response = await POST(request(JSON.stringify({ userMsg: 'x'.repeat(270000) })));
  expect(response.status).toBe(413); expect(state.reservations).toBe(0);
 });
 it('keeps the success contract', async () => {
  const response = await POST(request('{"userMsg":"Explain SPY","lang":"en"}'));
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ result: { questions: [] } }); expect(state.calls).toBe(1);
 });
 it('redacts provider failures', async () => {
  state.fail = true; const response = await POST(request('{"userMsg":"Explain SPY"}'));
  expect(response.status).toBe(500); expect(await response.text()).not.toContain('secret');
 });
 it('fails closed with a safe 503 when usage cannot be reserved', async () => {
  state.unavailable = true; const response = await POST(request('{"userMsg":"Explain SPY"}'));
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('private'); expect(state.calls).toBe(0);
 });
});

it('returns Retry-After without invoking AI when the shared burst budget is exhausted',async()=>{
 state.limited=true;
 const response=await POST(request('{"userMsg":"Explain SPY"}'));
 expect(response.status).toBe(429);expect(response.headers.get('Retry-After')).toBe('17');expect(await response.json()).toEqual({error:'rate_limited'});expect(state.calls).toBe(0);
});

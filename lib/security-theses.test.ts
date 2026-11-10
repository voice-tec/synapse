import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state=vi.hoisted(()=>({saved:null as any}));
vi.mock('./supabase-server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:()=>{const b:any={select:()=>b,eq:()=>b,maybeSingle:async()=>({data:null})};return b;}})}));
vi.mock('./supabase-admin',()=>({createAdminClient:()=>({from:()=>({insert:(p:any)=>{state.saved=p;return {select:()=>({single:async()=>({data:p})})};}})})}));
import { POST } from '../app/api/theses/route';
beforeEach(()=>{state.saved=null;});
it('cannot launder client confidence and forged signal predicates through the admin writer',async()=>{
 const r=await POST(new NextRequest('http://localhost/api/theses',{method:'POST',body:JSON.stringify({clusterId:'fake',thesis:'Fake',source_ids:[],confidence:100,accuracy:100,status:'confirmed',is_public:true,signals:{confirm:[{kind:'ticker',metric:'SPY',op:'>',threshold:-999,fired:true}]}})}));
 expect(r.status).toBe(200);expect(state.saved.confidence).toBe(50);expect(state.saved.accuracy).toBeNull();expect(state.saved.status).toBe('active');expect(state.saved.is_public).toBeUndefined();expect(state.saved.signals).toEqual({confirm:[],invalidate:[]});
});

import { signThesisEvidence, verifyThesisEvidence } from './thesis-evidence';
it('accepts authentic AI evidence but rejects tampering, cross-user reuse, changed text and expiry',async()=>{
 vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-only-not-a-real-key');
 const cluster={thesis:'Real',confidence:75,signals:{confirm:[{kind:'ticker',text:'up',metric:'SPY',op:'>',threshold:10,fired:true}]}};
 const token=signThesisEvidence('owner',cluster);
 expect(verifyThesisEvidence(token,'owner','Real')?.confidence).toBe(75);
 expect(verifyThesisEvidence(token,'other','Real')).toBeNull();
 expect(verifyThesisEvidence(token,'owner','Fake')).toBeNull();
 const [body,sig]=token.split('.');const forged=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(body,'base64url').toString()),confidence:100})).toString('base64url');
 expect(verifyThesisEvidence(`${forged}.${sig}`,'owner','Real')).toBeNull();
 const r=await POST(new NextRequest('http://localhost/api/theses',{method:'POST',body:JSON.stringify({clusterId:'real',thesis:'Real',source_ids:[],confidence:100,evidence:token,signals:{confirm:[]}})}));
 expect(r.status).toBe(200);expect(state.saved.confidence).toBe(75);expect(state.saved.signals.confirm[0].threshold).toBe(10);expect(state.saved.signals.confirm[0].fired).toBeUndefined();
 vi.spyOn(Date,'now').mockReturnValue(Date.now()+3600001);
 expect(verifyThesisEvidence(token,'owner','Real')).toBeNull();
 vi.restoreAllMocks();vi.unstubAllEnvs();
});

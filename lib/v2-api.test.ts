import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
const state=vi.hoisted(()=>({user:'00000000-0000-4000-8000-000000000001',client:null as any}));
vi.mock('./supabase-server',()=>({createClient:async()=>state.client}));
vi.mock('./supabase-admin',()=>({createAdminClient:()=>{throw new Error('PATCH must not bypass RLS');}}));
import { GET, PATCH } from '../app/api/theses/route';
let db:PGlite;
const owner=state.user,other='00000000-0000-4000-8000-000000000002', id='00000000-0000-4000-8000-000000000010';
async function query(sql:string,values:any[]=[]){
 await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${state.user}',false)`);
 try{return await db.query(sql,values);}finally{await db.exec('reset role');}
}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated;alter default privileges in schema public grant all on tables to authenticated,service_role;`);
 await db.exec(readFileSync('supabase/schema.sql','utf8'));await db.exec(readFileSync('supabase/migrations/001_v2_security_and_versions.sql','utf8'));
 await db.exec(`insert into auth.users values('${owner}','a@local'),('${other}','b@local');insert into theses(id,user_id,cluster_id,thesis) values('${id}','${owner}','owned','Original');`);
 state.client={auth:{getUser:async()=>({data:{user:state.user?{id:state.user}:null}})},
 from:(table:string)=>{
  const clauses:string[]=[],values:any[]=[];let ordering='';
  const execute=async(single=false)=>{try{const r=await query(`select * from ${table} where ${clauses.join(' and ')} ${ordering}`,values);return {data:single?r.rows[0]||null:r.rows,error:null};}catch(error){return {data:null,error};}};
  const builder:any={select:()=>builder,eq:(key:string,value:any)=>{values.push(value);clauses.push(`${key}=$${values.length}`);return builder;},order:(key:string)=>{ordering=`order by ${key} desc`;return builder;},maybeSingle:()=>execute(true),then:(resolve:any,reject:any)=>execute().then(resolve,reject)};return builder;
 },rpc:async(name:string,args:any)=>{try{const r=await query(`select revise_thesis($1,$2,$3) as thesis`,[args.p_id,args.p_revision,JSON.stringify(args.p_patch)]);return {data:(r.rows[0] as any).thesis,error:null};}catch(error){return {data:null,error};}}};
},20000);
afterAll(async()=>{await db.close();});
const request=(body:any)=>new NextRequest('http://localhost/api/theses',{method:'PATCH',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
describe('Thesis Card routes with real PostgreSQL/RLS',()=>{
 it('requires authentication and rejects another owner',async()=>{
  state.user='';expect((await GET(new NextRequest('http://localhost/api/theses?cluster=owned'))).status).toBe(401);
  state.user=other;expect((await GET(new NextRequest('http://localhost/api/theses?cluster=owned'))).status).toBe(404);
  expect((await PATCH(request({id,revision:1,thesis:'Attack',reason:'Fake',assets:[],workflow_state:'monitoring'}))).status).toBe(404);
 });
 it('saves, reloads original/history, ignores forged results and returns conflict for stale updates',async()=>{
  state.user=owner;
  const input={id,revision:1,thesis:'Revised',reason:'Review',assets:['SPY'],workflow_state:'monitoring',accuracy:100,status:'confirmed',original_hypothesis:'Forged'};
  const saved=await PATCH(request(input));expect(saved.status).toBe(200);
  expect((await PATCH(request(input))).status).toBe(409);
  const response=await GET(new NextRequest('http://localhost/api/theses?cluster=owned'));const data=await response.json();
  expect(data.thesis.original_hypothesis).toBe('Original');expect(data.thesis.status).toBe('active');expect(data.thesis.accuracy).toBeNull();expect(data.versions).toHaveLength(2);expect(data.versions[1].snapshot.thesis).toBe('Original');expect(data.thesis.assets).toEqual(['SPY']);
 });
});

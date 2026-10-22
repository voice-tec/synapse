import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
let db: PGlite;
const u1='00000000-0000-4000-8000-000000000001', u2='00000000-0000-4000-8000-000000000002';
const th='00000000-0000-4000-8000-000000000010', task='00000000-0000-4000-8000-000000000020';
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 grant execute on function auth.uid() to authenticated;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
 await db.exec(readFileSync('supabase/schema.sql','utf8'));
 await db.exec(`insert into auth.users values('${u1}','a@local.test'),('${u2}','b@local.test');
 insert into tasks(id,user_id,raw_query) values('${task}','${u2}','private');
 insert into theses(id,user_id,cluster_id,thesis,confidence) values('${th}','${u1}','legacy','Original',75);`);
 await db.exec(readFileSync('supabase/migrations/001_v2_security_and_versions.sql','utf8'));
},20000);
afterAll(async()=>{await db?.close();});
async function asUser(sql: string, user=u1) {
 await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
 try{return await db.query(sql);}finally{await db.exec('reset role');}
}
describe('V2 database authorization and immutable history',()=>{
 it('blocks plan, counters and forged results but allows own display name',async()=>{
  await expect(asUser(`update profiles set plan='pro' where id='${u1}'`)).rejects.toThrow(/permission denied/);
  await expect(asUser(`update profiles set tasks_this_month=0 where id='${u1}'`)).rejects.toThrow(/permission denied/);
  await expect(asUser(`update theses set status='confirmed',accuracy=100 where id='${th}'`)).rejects.toThrow(/permission denied/);
  await asUser(`update profiles set display_name='Test' where id='${u1}'`);
  await expect(asUser(`insert into profiles(id,plan) values('${u1}','pro')`)).rejects.toThrow(/permission denied/);
 });
 it('prohibits cross-owner references including source arrays',async()=>{
  await expect(asUser(`insert into connections(user_id,task_from,task_to) values('${u1}','${task}','${task}')`)).rejects.toThrow(/cross_owner/);
  await expect(asUser(`insert into actions(user_id,cluster_id,thesis_id) values('${u2}','x','${th}')`,u2)).rejects.toThrow(/cross_owner/);
  await expect(db.exec(`update theses set source_task_ids=array['${task}'::uuid] where id='${th}'`)).rejects.toThrow(/cross_owner/);
 });
 it('keeps private versions private and blocks mutation',async()=>{
  expect((await asUser(`select * from thesis_versions where thesis_id='${th}'`,u2)).rows).toHaveLength(0);
  await expect(asUser(`update thesis_versions set reason='fake'`)).rejects.toThrow(/permission denied/);
  await expect(asUser(`delete from thesis_versions`)).rejects.toThrow(/permission denied/);
  await expect(asUser(`insert into thesis_versions(thesis_id,user_id,revision,reason,snapshot) values('${th}','${u1}',2,'fake','{}')`)).rejects.toThrow(/permission denied/);
 });
 it('records migration baseline at ingestion time; preserves original and rejects stale revisions',async()=>{
  const before:any=(await db.query('select * from thesis_versions')).rows[0];
  expect(before.reason).toBe('migration_baseline'); expect(before.snapshot.thesis).toBe('Original');
  const patch=JSON.stringify({thesis:'Revised',reason:'New research',assets:['SPY'],workflow_state:'monitoring',success_condition:'Outperform benchmark'});
  await asUser(`select revise_thesis('${th}',1,'${patch}')`);
  const current:any=(await db.query(`select * from theses where id='${th}'`)).rows[0];
  expect(current.original_hypothesis).toBe('Original');expect(current.revision).toBe(2);
  await expect(asUser(`select revise_thesis('${th}',1,'${patch}')`)).rejects.toThrow(/revision_conflict/);
  await expect(asUser(`select revise_thesis('${th}',2,'${patch}')`,u2)).rejects.toThrow(/not_found/);
  expect((await db.query('select * from thesis_versions')).rows).toHaveLength(2);
 });
 it('serializes quota reservations and refuses client RPC abuse',async()=>{
  await expect(asUser(`select reserve_usage('${u1}','analysis')`)).rejects.toThrow(/permission denied/);
  const results=await Promise.all(Array.from({length:15},()=>db.query(`select reserve_usage('${u1}','analysis') as gate`)));
  expect(results.filter(r=>(r.rows[0] as any).gate.allowed)).toHaveLength(10);
  expect((await db.query(`select tasks_this_month from profiles where id='${u1}'`)).rows[0]).toEqual({tasks_this_month:10});
 });
 it('executes the standalone SQL RLS contract',async()=>{
  await db.exec(readFileSync('supabase/tests/v2_rls.sql','utf8'));
 });
 it('allows portfolio content updates without opening financial fields',async()=>{
  await asUser(`insert into actions(user_id,thesis_id,cluster_id,title) values('${u1}','${th}','action-test','Before')`);
  await asUser(`update actions set title='After' where cluster_id='action-test'`);
  expect((await asUser(`select title from actions where cluster_id='action-test'`)).rows[0]).toEqual({title:'After'});
  await expect(asUser(`update actions set performance='{"overall":"+900%"}' where cluster_id='action-test'`)).rejects.toThrow(/permission denied/);
 });
 it('restricts watch creation and enforces the free plan limit in the database',async()=>{
  const ids=['00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000033'];
  for(const taskId of ids)await db.exec(`insert into tasks(id,user_id,raw_query) values('${taskId}','${u1}','watch')`);
  await expect(asUser(`insert into watches(user_id,task_id,query) values('${u1}','${ids[0]}','x')`)).rejects.toThrow(/permission denied/);
  for(const taskId of ids.slice(0,2))await db.exec(`insert into watches(user_id,task_id,query) values('${u1}','${taskId}','x')`);
  await expect(db.exec(`insert into watches(user_id,task_id,query) values('${u1}','${ids[2]}','x')`)).rejects.toThrow(/watch_limit/);
 });
 it('preserves versions after deleting a graph node',async()=>{
  await asUser(`delete from theses where id='${th}'`);
  expect((await asUser(`select * from thesis_versions where thesis_id='${th}'`)).rows).toHaveLength(2);
 });
});

import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, expect, it } from 'vitest';
let db: PGlite;
const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
beforeAll(async () => {
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
 await db.exec(readFileSync('supabase/schema.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/001_v2_security_and_versions.sql','utf8'));
 const migration='supabase/migrations/002_security_hardening.sql';
 await db.exec(readFileSync(migration,'utf8'));
 await db.exec(`insert into auth.users values('${a}','a@local'),('${b}','b@local'); insert into tasks(user_id,raw_query) values('${a}','private A'),('${b}','private B');`);
},20000);
afterAll(async()=>{await db?.close();});
async function asRole(sql:string,role='authenticated',user=a) {
 await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${user}',false)`);
 try{return await db.query(sql);}finally{await db.exec('reset role');}
}
it('does not grant TRUNCATE or anonymous access to graph tables',async()=>{
 for(const table of ['profiles','tasks','connections','theses','actions','watches','shared_graphs','thesis_versions']) {
  const r=await db.query(`select has_table_privilege('authenticated','${table}','TRUNCATE') as allowed`);expect(r.rows[0]).toEqual({allowed:false});
  await expect(asRole(`select * from ${table}`,'anon')).rejects.toThrow(/permission denied/);
 }
});
it('blocks forged task timestamps and shared snapshots while retaining graph saves',async()=>{
 await expect(asRole(`insert into tasks(user_id,raw_query,created_at) values('${a}','fake','2000-01-01')`)).rejects.toThrow(/permission denied/);
 await expect(asRole(`insert into shared_graphs(user_id,token,snapshot) values('${a}','fake','{}')`)).rejects.toThrow(/permission denied/);
 await asRole(`insert into tasks(user_id,raw_query,output) values('${a}','legitimate','{}')`);
 expect((await asRole('select raw_query from tasks')).rows).toHaveLength(2);
 expect((await asRole(`delete from tasks where user_id='${b}' returning id`)).rows).toHaveLength(0);
 await expect(asRole(`insert into tasks(user_id,raw_query) values('${b}','attack')`)).rejects.toThrow(/row-level security/);
});
it('rejects quota abuse, limits bursts atomically and resumes after window expiry',async()=>{
 await expect(asRole(`select reserve_usage('${b}','ai')`)).rejects.toThrow(/permission denied/);
 await db.exec('set role service_role');
 let results: any[];
 try { results=await Promise.all(Array.from({length:25},()=>db.query(`select reserve_usage('${a}','ai') as gate`))); }
 finally { await db.exec('reset role'); }
 expect(results.filter(r=>(r.rows[0] as any).gate.allowed)).toHaveLength(20);
 expect((await db.query(`select ai_calls_this_month from profiles where id='${a}'`)).rows[0]).toEqual({ai_calls_this_month:20});
 const denied=(results.find(r=>!(r.rows[0] as any).gate.allowed)!.rows[0] as any).gate;
 expect(denied.reason).toBe('rate_limited');expect(denied.retry_after).toBeGreaterThan(0);
 await db.exec(`update profiles set usage_window_started_at=now()-interval '61 seconds' where id='${a}'`);
 expect(((await asRole(`select reserve_usage('${a}','ai') as gate`,'service_role')).rows[0] as any).gate.allowed).toBe(true);
 await expect(asRole(`update profiles set usage_window_count=0 where id='${a}'`)).rejects.toThrow(/permission denied/);
 await expect(asRole(`select reserve_usage('${a}',null)`,'service_role')).rejects.toThrow(/invalid_kind/);
});
it('keeps every graph entity private while allowing its owner to read it',async()=>{
 const task=(await db.query(`select id from tasks where user_id='${a}' limit 1`)).rows[0] as any;
 const thesis=(await db.query(`insert into theses(user_id,cluster_id,thesis) values('${a}','isolation','Private') returning id`)).rows[0] as any;
 await db.exec(`insert into connections(user_id,task_from,task_to) values('${a}','${task.id}','${task.id}');
 insert into actions(user_id,thesis_id,cluster_id) values('${a}','${thesis.id}','isolation');
 insert into watches(user_id,task_id,query) values('${a}','${task.id}','Private');
 insert into shared_graphs(user_id,token,snapshot) values('${a}','private-token','{}');`);
 for(const table of ['profiles','tasks','connections','theses','actions','watches','shared_graphs','thesis_versions']) {
  const ownerColumn=table==='profiles'?'id':'user_id';
  expect((await asRole(`select * from ${table} where ${ownerColumn}='${a}'`)).rows.length).toBeGreaterThan(0);
  expect((await asRole(`select * from ${table} where ${ownerColumn}='${a}'`,'authenticated',b)).rows).toHaveLength(0);
 }
 for(const [table, column, value] of [
  ['profiles','plan',"'team'"], ['profiles','ai_calls_this_month','0'], ['profiles','refresh_batch_id',"'fake'"],
  ['theses','confidence','100'], ['theses','accuracy','100'], ['theses','status',"'confirmed'"],
  ['theses','is_public','true'], ['theses','created_at',"'2000-01-01'"], ['theses','signals',"'{}'"],
  ['actions','performance',"'{}'"], ['watches','active','false'],
 ]) await expect(asRole(`update ${table} set ${column}=${value}`)).rejects.toThrow(/permission denied/);
 await asRole(`update theses set pos_x=123,pos_y=456,color='#abcdef' where id='${thesis.id}'`);
 expect((await asRole(`update theses set pos_x=999 where id='${thesis.id}' returning id`,'authenticated',b)).rows).toHaveLength(0);
});
it('enforces both monthly caps independently and does not charge denied reservations',async()=>{
 await db.exec(`update profiles set tasks_this_month=9,ai_calls_this_month=49,usage_window_count=0,usage_window_started_at=null where id='${b}'`);
 for(const kind of ['analysis','ai']) {
  expect(((await asRole(`select reserve_usage('${b}','${kind}') as gate`,'service_role')).rows[0] as any).gate.allowed).toBe(true);
  expect(((await asRole(`select reserve_usage('${b}','${kind}') as gate`,'service_role')).rows[0] as any).gate.allowed).toBe(false);
 }
 expect((await db.query(`select tasks_this_month,ai_calls_this_month,usage_window_count from profiles where id='${b}'`)).rows[0]).toEqual({tasks_this_month:10,ai_calls_this_month:50,usage_window_count:2});
});
it('passes the standalone staging SQL contract',async()=>{
 await db.exec(readFileSync('supabase/tests/security_hardening.sql','utf8'));
});

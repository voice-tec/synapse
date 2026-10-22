-- Solo database di staging/disposable, dopo schema + migrazione. Sempre rollback.
-- psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/v2_rls.sql
begin;
insert into auth.users(id,email) values
 ('f0000000-0000-4000-8000-000000000001','v2-test-a@invalid.example'),
 ('f0000000-0000-4000-8000-000000000002','v2-test-b@invalid.example');
insert into public.tasks(id,user_id,raw_query) values
 ('f0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000002','private');
insert into public.theses(id,user_id,cluster_id,thesis) values
 ('f0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000001','v2-rls-test','Original');
set local role authenticated;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
do $$ begin
 begin
  update public.profiles set plan='pro' where id=auth.uid();
  raise exception 'FAIL: client can promote plan';
 exception when insufficient_privilege then null; end;
 begin
  update public.profiles set tasks_this_month=0 where id=auth.uid();
  raise exception 'FAIL: client can reset quota';
 exception when insufficient_privilege then null; end;
 begin
  update public.theses set status='confirmed',accuracy=100 where user_id=auth.uid();
  raise exception 'FAIL: client can forge results';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.connections(user_id,task_from,task_to) values(auth.uid(),'f0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000003');
  raise exception 'FAIL: cross-user edge accepted';
 exception when check_violation then null; end;
 begin
  delete from public.thesis_versions;
  raise exception 'FAIL: versions deletable';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.tasks) then raise exception 'FAIL: private task visible'; end if;
end $$;
select public.revise_thesis('f0000000-0000-4000-8000-000000000004',1,
 '{"thesis":"Revised","reason":"Research update","assets":["SPY"],"workflow_state":"monitoring"}'::jsonb);
do $$ begin
 if (select count(*) from public.thesis_versions) <> 2 then raise exception 'FAIL: versions missing'; end if;
 if (select original_hypothesis from public.theses limit 1) <> 'Original' then raise exception 'FAIL: original overwritten'; end if;
 begin
  perform public.revise_thesis('f0000000-0000-4000-8000-000000000004',1,'{"thesis":"Stale","reason":"Conflict"}');
  raise exception 'FAIL: stale revision accepted';
 exception when serialization_failure then null; end;
end $$;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.thesis_versions) then raise exception 'FAIL: private versions leaked'; end if;
end $$;
rollback;

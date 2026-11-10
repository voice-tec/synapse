-- Solo staging/disposable, DOPO 001 e 002. Eseguire con ON_ERROR_STOP=1.
-- Tutte le fixture vengono annullate; non eseguire in produzione.
begin;
insert into auth.users(id,email) values ('e0000000-0000-4000-8000-000000000001','security-sprint@invalid.example');
set local role authenticated;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
do $$ declare tab text; begin
 foreach tab in array array['profiles','tasks','connections','theses','actions','watches','shared_graphs','thesis_versions'] loop
  if has_table_privilege('authenticated','public.'||tab,'TRUNCATE') then raise exception 'FAIL: truncate allowed on %',tab; end if;
 end loop;
 begin
  update public.profiles set usage_window_count=0 where id=auth.uid();
  raise exception 'FAIL: window reset allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.shared_graphs(user_id,token,snapshot) values(auth.uid(),'forged','{}');
  raise exception 'FAIL: snapshot forgery allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.tasks(user_id,raw_query,created_at) values(auth.uid(),'forged','2000-01-01');
  raise exception 'FAIL: task backdating allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.reserve_usage(auth.uid(),'ai');
  raise exception 'FAIL: client can reserve quota';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ declare gate jsonb; accepted integer:=0; begin
 for i in 1..25 loop
  gate:=public.reserve_usage('e0000000-0000-4000-8000-000000000001','ai');
  if (gate->>'allowed')::boolean then accepted:=accepted+1; end if;
 end loop;
 if accepted<>20 or gate->>'reason'<>'rate_limited' then raise exception 'FAIL: burst limit'; end if;
 if (select ai_calls_this_month from public.profiles where id='e0000000-0000-4000-8000-000000000001')<>20 then raise exception 'FAIL: denied requests charged'; end if;
end $$;
rollback;

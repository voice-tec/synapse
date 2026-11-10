-- Eseguire manualmente DOPO 001_v2_security_and_versions.sql. Nessun reset dati.
begin;
-- RLS non limita TRUNCATE. Allowlist esplicita per le tabelle legacy residue.
revoke all on public.tasks, public.connections, public.shared_graphs from public, anon, authenticated;
grant select, delete on public.tasks, public.connections to authenticated;
grant insert (user_id, raw_query, intent, fingerprint, output, origin_kind, origin_ref) on public.tasks to authenticated;
grant insert (user_id, task_from, task_to, type, score) on public.connections to authenticated;
grant select, delete on public.shared_graphs to authenticated;
-- Chiude anche eventuali grant PUBLIC sulle tabelle già protette da 001.
revoke all on public.profiles, public.theses, public.actions, public.watches, public.thesis_versions from public;

alter table public.profiles add column usage_window_started_at timestamptz;
alter table public.profiles add column usage_window_count integer not null default 0 check (usage_window_count >= 0);
-- Un solo lock protegge entrambi i budget mensili e la finestra condivisa.
-- La finestra ammette 20 prenotazioni/minuto per utente, indipendentemente dal piano.
create or replace function public.reserve_usage(p_user uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare p profiles; n integer; lim integer; stamp timestamptz := clock_timestamp(); retry integer;
begin
 if p_kind is null or p_kind not in ('analysis','ai') then raise exception 'invalid_kind'; end if;
 select * into p from profiles where id=p_user for update;
 if not found then raise exception 'profile_missing'; end if;
 -- Misurare dopo il lock: una richiesta in attesa non usa una finestra scaduta.
 stamp := clock_timestamp();
 lim := case when p_kind='analysis' then case when p.plan in ('pro','team') then 150 else 10 end
             else case when p.plan in ('pro','team') then 500 else 50 end end;
 n := greatest(0,coalesce(case when p_kind='analysis' then p.tasks_this_month else p.ai_calls_this_month end,0));
 if n >= lim then return jsonb_build_object('allowed',false,'used',n,'limit',lim,'plan',p.plan); end if;
 if p.usage_window_started_at is null or p.usage_window_started_at <= stamp - interval '60 seconds' then
   p.usage_window_started_at := stamp; p.usage_window_count := 0;
 end if;
 if p.usage_window_count >= 20 then
   retry := greatest(1,ceil(extract(epoch from p.usage_window_started_at + interval '60 seconds' - stamp))::integer);
   return jsonb_build_object('allowed',false,'used',n,'limit',lim,'plan',p.plan,'reason','rate_limited','retry_after',retry);
 end if;
 update profiles set
   tasks_this_month=case when p_kind='analysis' then n+1 else tasks_this_month end,
   ai_calls_this_month=case when p_kind='ai' then n+1 else ai_calls_this_month end,
   usage_window_started_at=p.usage_window_started_at, usage_window_count=p.usage_window_count+1
 where id=p_user;
 return jsonb_build_object('allowed',true,'used',n+1,'limit',lim,'plan',p.plan);
end $$;
revoke all on function public.reserve_usage(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_usage(uuid,text) to service_role;
commit;

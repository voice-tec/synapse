-- Applicazione MANUALE dopo backup e test. Nessuna chiamata a servizi esterni.
begin;
-- Fermarsi sui collegamenti legacy non validi: riconciliazione manuale obbligatoria.
do $$ begin
 if exists(select 1 from public.connections c join public.tasks a on a.id=c.task_from join public.tasks b on b.id=c.task_to where c.user_id<>a.user_id or c.user_id<>b.user_id)
 or exists(select 1 from public.actions a join public.theses t on t.id=a.thesis_id where a.user_id<>t.user_id)
 or exists(select 1 from public.watches w join public.tasks t on t.id=w.task_id where w.user_id<>t.user_id)
 or exists(select 1 from public.theses t cross join lateral unnest(t.source_task_ids) s where not exists(select 1 from public.tasks a where a.id=s and a.user_id=t.user_id))
 then raise exception 'legacy_invalid_references: reconcile before migration'; end if;
end $$;

update public.profiles set tasks_this_month=greatest(0,coalesce(tasks_this_month,0)),
 ai_calls_this_month=greatest(0,coalesce(ai_calls_this_month,0));
alter table public.profiles add constraint v2_usage_nonnegative
 check (tasks_this_month>=0 and ai_calls_this_month>=0);
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, portfolio) on public.profiles to authenticated;
revoke all on public.theses from anon, authenticated;
grant select, delete on public.theses to authenticated;
grant update (pos_x, pos_y, color) on public.theses to authenticated;
revoke all on public.actions from anon, authenticated;
grant select, delete on public.actions to authenticated;
grant insert (user_id, thesis_id, cluster_id, title, summary, categories, caveat, pos_x, pos_y),
  update (thesis_id, cluster_id, title, summary, categories, caveat, pos_x, pos_y) on public.actions to authenticated;

revoke all on public.watches from anon, authenticated;
grant select, delete on public.watches to authenticated;
grant update (flip_seen) on public.watches to authenticated;
-- Il lock sul profilo impedisce creazioni concorrenti oltre il limite.
create function public.v2_watch_limit() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare p profiles; lim integer;
begin
 if not new.active then return new; end if;
 select * into p from profiles where id=new.user_id for update;
 lim := case when p.plan in ('pro','team') then 30 else 2 end;
 if (select count(*) from watches where user_id=new.user_id and active and task_id<>new.task_id)>=lim then
  raise exception 'watch_limit' using errcode='23514';
 end if;
 return new;
end $$;
create trigger v2_watch_limit before insert or update of active on public.watches for each row execute function public.v2_watch_limit();

alter table public.theses add column conviction_base integer;
alter table public.theses add column original_hypothesis text;
alter table public.theses add column assets text[] not null default '{}';
alter table public.theses add column investment_horizon text;
alter table public.theses add column evaluation_deadline date;
alter table public.theses add column benchmark text;
alter table public.theses add column success_condition text;
alter table public.theses add column invalidation_conditions text;
alter table public.theses add column workflow_state text not null default 'researching'
  check (workflow_state in ('researching','monitoring','review_needed','archived'));
alter table public.theses add column revision integer not null default 1;
alter table public.theses add column revision_reason text;
alter table public.theses add column versioning_started_at timestamptz not null default now();
alter table public.theses add constraint theses_conviction_range check (conviction_base between 0 and 100);
-- Blocca la migrazione in presenza di duplicati: riconciliare manualmente, mai cancellarli.
create unique index theses_owner_cluster_unique on public.theses(user_id, cluster_id);
update public.theses set original_hypothesis = thesis,
 conviction_base = case when imported_from_author is not null then greatest(0,least(100,coalesce(confidence,50))) else null end,
 revision_reason = 'migration_baseline';
-- Rimuove annotazioni di valutazione, conserva predicati e note legacy.
create function public.v2_signal_predicates(s jsonb) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
 select case when s is null then null else jsonb_build_object(
  'confirm',coalesce((select jsonb_agg(case when jsonb_typeof(v)='object' then v - array['fired','checked_at','data_missing'] else v end) from jsonb_array_elements(case when jsonb_typeof(s->'confirm')='array' then s->'confirm' else '[]' end) v),'[]'::jsonb),
  'invalidate',coalesce((select jsonb_agg(case when jsonb_typeof(v)='object' then v - array['fired','checked_at','data_missing'] else v end) from jsonb_array_elements(case when jsonb_typeof(s->'invalidate')='array' then s->'invalidate' else '[]' end) v),'[]'::jsonb)
 ) end
$$;
-- I vecchi risultati erano modificabili dai client: richiedere nuova valutazione.
update public.theses set status='active',accuracy=null,signals_hit=0,signals_total=0,closed_at=null,signals=public.v2_signal_predicates(signals);
update public.actions set performance=null,performance_updated_at=null;

create table public.thesis_versions (
 id uuid primary key default gen_random_uuid(),
 thesis_id uuid not null,
 user_id uuid not null references auth.users on delete cascade,
 revision integer not null,
 recorded_at timestamptz not null default clock_timestamp(),
 reason text not null,
 snapshot jsonb not null,
 unique(thesis_id, revision)
);
-- Nessun cascade dalla tesi: eliminare un nodo non cancella lo storico.
alter table public.thesis_versions enable row level security;
create policy "own versions" on public.thesis_versions for select using (auth.uid() = user_id);
revoke all on public.thesis_versions from anon, authenticated;
grant select on public.thesis_versions to authenticated;
insert into public.thesis_versions(thesis_id,user_id,revision,reason,snapshot)
 select id,user_id,revision,'migration_baseline',to_jsonb(t) from public.theses t;

create function public.v2_version_thesis() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
 if TG_OP = 'INSERT' then
   new.original_hypothesis := new.thesis;
   new.revision := 1;
   new.created_at := clock_timestamp();
   new.versioning_started_at := new.created_at;
 else
   new.original_hypothesis := old.original_hypothesis;
   new.created_at := old.created_at;
   new.versioning_started_at := old.versioning_started_at;
   new.user_id := old.user_id;
   -- Layout e timestamp di staleness non sono revisioni di ricerca.
   if (to_jsonb(new) - array['pos_x','pos_y','color','updated_at','revision','revision_reason','is_public'])
      is not distinct from
      (to_jsonb(old) - array['pos_x','pos_y','color','updated_at','revision','revision_reason','is_public']) then
     new.revision := old.revision;
     return new;
   end if;
   new.revision := old.revision + 1;
 end if;
 new.updated_at := clock_timestamp();
 insert into public.thesis_versions(thesis_id,user_id,revision,reason,snapshot)
 values(new.id,new.user_id,new.revision,coalesce(nullif(new.revision_reason,''),'system_update'),to_jsonb(new));
 return new;
end $$;
create trigger v2_version_thesis before insert or update on public.theses for each row execute function public.v2_version_thesis();

create function public.v2_no_version_update() returns trigger language plpgsql as $$
begin raise exception 'versions_are_append_only' using errcode='42501'; end $$;
create trigger v2_no_version_update before update on public.thesis_versions for each row execute function public.v2_no_version_update();
-- DELETE consentito solo al cascade di eliminazione account, non alle API.
revoke update, delete on public.thesis_versions from service_role;

create function public.v2_own_references() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
 if TG_TABLE_NAME = 'connections' then
   if not exists(select 1 from tasks where id=new.task_from and user_id=new.user_id)
     or not exists(select 1 from tasks where id=new.task_to and user_id=new.user_id) then raise exception 'cross_owner_reference' using errcode='23514'; end if;
 elsif TG_TABLE_NAME = 'actions' then
   if new.thesis_id is not null and not exists(select 1 from theses where id=new.thesis_id and user_id=new.user_id) then raise exception 'cross_owner_reference' using errcode='23514'; end if;
 elsif TG_TABLE_NAME = 'watches' then
   if not exists(select 1 from tasks where id=new.task_id and user_id=new.user_id) then raise exception 'cross_owner_reference' using errcode='23514'; end if;
 elsif TG_TABLE_NAME = 'theses' then
   if exists(select 1 from unnest(new.source_task_ids) s where not exists(select 1 from tasks t where t.id=s and t.user_id=new.user_id)) then raise exception 'cross_owner_reference' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger v2_own_connections before insert or update on public.connections for each row execute function public.v2_own_references();
create trigger v2_own_actions before insert or update on public.actions for each row execute function public.v2_own_references();
create trigger v2_own_watches before insert or update on public.watches for each row execute function public.v2_own_references();
create trigger v2_own_theses before insert or update on public.theses for each row execute function public.v2_own_references();

-- Una prenotazione atomica PRIMA di chiamare il provider. Solo backend.
create function public.reserve_usage(p_user uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare p profiles; n integer; lim integer;
begin
 if p_kind not in ('analysis','ai') then raise exception 'invalid_kind'; end if;
 select * into p from profiles where id=p_user for update;
 if not found then raise exception 'profile_missing'; end if;
 lim := case when p_kind='analysis' then case when p.plan in ('pro','team') then 150 else 10 end
             else case when p.plan in ('pro','team') then 500 else 50 end end;
 n := greatest(0,coalesce(case when p_kind='analysis' then p.tasks_this_month else p.ai_calls_this_month end,0));
 if n >= lim then return jsonb_build_object('allowed',false,'used',n,'limit',lim,'plan',p.plan); end if;
 if p_kind='analysis' then update profiles set tasks_this_month=n+1 where id=p_user;
 else update profiles set ai_calls_this_month=n+1 where id=p_user; end if;
 return jsonb_build_object('allowed',true,'used',n+1,'limit',lim,'plan',p.plan);
end $$;
revoke all on function public.reserve_usage(uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_usage(uuid,text) to service_role;

-- PATCH autorizzato con lock e confronto revisione. Il ruolo utente usa RLS.
create function public.revise_thesis(p_id uuid, p_revision integer, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare t theses;
begin
 select * into t from theses where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'not_found' using errcode='P0002'; end if;
 if t.revision <> p_revision then raise exception 'revision_conflict' using errcode='40001'; end if;
 if length(trim(coalesce(p_patch->>'thesis',''))) not between 1 and 4000
    or length(trim(coalesce(p_patch->>'reason',''))) not between 1 and 1000
    or length(p_patch::text)>30000 then raise exception 'invalid_revision' using errcode='22023'; end if;
 update theses set thesis=p_patch->>'thesis', explanation=p_patch->>'explanation',
 assets=array(select jsonb_array_elements_text(coalesce(p_patch->'assets','[]'::jsonb))),
 sector=p_patch->>'sector', investment_horizon=p_patch->>'investment_horizon',
 evaluation_deadline=nullif(p_patch->>'evaluation_deadline','')::date,
 benchmark=p_patch->>'benchmark', success_condition=p_patch->>'success_condition',
 invalidation_conditions=p_patch->>'invalidation_conditions', workflow_state=coalesce(p_patch->>'workflow_state','researching'),
 revision_reason=p_patch->>'reason', signals=public.v2_signal_predicates(signals), status='active', accuracy=null, signals_hit=0, signals_total=0, closed_at=null
 where id=t.id returning * into t;
 return to_jsonb(t);
end $$;
revoke all on function public.revise_thesis(uuid,integer,jsonb) from public,anon;
grant execute on function public.revise_thesis(uuid,integer,jsonb) to authenticated;
-- Hardening del trigger signup esistente.
alter function public.handle_new_user() set search_path = public, pg_temp;
commit;

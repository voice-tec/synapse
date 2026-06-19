-- ═══════════════════════════════════════════════
-- SYNAPSE — Schema database
-- Esegui questo nel SQL Editor di Supabase
-- ═══════════════════════════════════════════════

-- ── PROFILI UTENTE ──
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  plan text default 'free',                    -- free | pro | team
  display_name text,                           -- nome pubblico opt-in (marketplace); null = anonimo
  tasks_this_month int default 0,
  ai_calls_this_month int default 0,           -- memory/suggest/portfolio/challenge
  refresh_batch_id text,                       -- batch Anthropic pendente per il refresh tesi
  portfolio jsonb,                             -- holdings REALI dichiarate: [{ticker,name,weight}]
  created_at timestamptz default now()
);

-- ── TASK (i nodi del grafo) ──
create table tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  raw_query text not null,
  intent jsonb,
  fingerprint jsonb,
  output jsonb,
  origin_kind text,                            -- provenance: 'task' | 'thesis' | null
  origin_ref text,                             -- task: uuid sorgente · thesis: cluster_id stabile
  created_at timestamptz default now()
);

-- ── CONNESSIONI (gli archi del grafo) ──
create table connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  task_from uuid references tasks on delete cascade not null,
  task_to uuid references tasks on delete cascade not null,
  type text,
  score float,
  created_at timestamptz default now()
);

-- ── TESI / NODI MEMORIA (con storico) ──
create table theses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  cluster_id text not null,
  thesis text,
  confidence int,
  explanation text,
  pattern text,
  suggested_question text,
  source_task_ids uuid[],
  history jsonb default '[]',                  -- [{thesis, confidence, date, note}]
  challenge jsonb,                             -- contro-tesi (avvocato del diavolo)
  signals jsonb,                               -- {confirm:[Sig],invalidate:[Sig]} Sig={text,kind:fred|ticker|manual,metric,op,threshold,fired,checked_at}
  status text default 'active',                -- track record: active | confirmed | invalidated (dedotto dai segnali)
  accuracy float,                              -- 0..100, quota di confirm tra i segnali scattati; null finché nessuno scatta
  signals_hit int default 0,                   -- confirm scattati
  signals_total int default 0,                 -- segnali testabili (con metric/op/threshold)
  closed_at timestamptz,                        -- quando status è passato a confirmed/invalidated
  outcome_note text,
  color text,
  pos_x float,
  pos_y float,
  imported_from_token text,                    -- token del grafo da cui è stata importata (null se nativa)
  imported_from_author text,                   -- hash opaco dell'autore sorgente (badge "importata")
  is_public boolean default false,             -- pubblicata nel marketplace (opt-in per tesi)
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ── AZIONI (portafogli delle tesi) ──
create table actions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  thesis_id uuid references theses on delete set null,
  cluster_id text not null,
  title text,
  summary text,
  categories jsonb,
  caveat text,
  performance jsonb,                           -- {overall, items:[{ticker, perf}], note}
  performance_updated_at timestamptz,
  pos_x float,
  pos_y float,
  created_at timestamptz default now()
);

-- ── WATCH ("avvisami se cambia"): ricontrollo periodico del verdetto ──
create table watches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  task_id uuid references tasks on delete cascade not null,
  query text not null,
  last_stance text,                            -- si | no | dipende
  last_label text,
  last_confidence text,
  last_checked_at timestamptz default now(),
  flip jsonb,                                  -- {old_stance,new_stance,new_label,detected_at}
  flip_seen boolean default false,
  active boolean default true,
  created_at timestamptz default now(),
  unique(user_id, task_id)
);

-- ── GRAFI CONDIVISI (snapshot pubblici read-only) ──
create table shared_graphs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  token text unique not null,
  title text,
  snapshot jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══════════════════════════════════════════════
-- ROW LEVEL SECURITY — ogni utente vede solo i suoi dati
-- ═══════════════════════════════════════════════

alter table profiles enable row level security;
alter table tasks enable row level security;
alter table connections enable row level security;
alter table theses enable row level security;
alter table actions enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id);

create policy "own tasks" on tasks
  for all using (auth.uid() = user_id);

create policy "own connections" on connections
  for all using (auth.uid() = user_id);

create policy "own theses" on theses
  for all using (auth.uid() = user_id);

create policy "own actions" on actions
  for all using (auth.uid() = user_id);

alter table watches enable row level security;
create policy "own watches" on watches
  for all using (auth.uid() = user_id);

-- Nessuna policy di lettura pubblica: la pagina /g/[token] passa dal
-- service role lato server, così i token non sono enumerabili
alter table shared_graphs enable row level security;
create policy "own shared graphs" on shared_graphs
  for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════
-- TRIGGER — crea automaticamente un profilo al signup
-- ═══════════════════════════════════════════════

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ═══════════════════════════════════════════════
-- RESET MENSILE — gestito dal Vercel cron /api/cron/reset-usage
-- (vedi vercel.json). In alternativa, manualmente:
-- update profiles set tasks_this_month = 0, ai_calls_this_month = 0;
-- ═══════════════════════════════════════════════

-- ═══════════════════════════════════════════════
-- MIGRAZIONE — se hai già un database creato con una versione
-- precedente di questo schema, esegui SOLO questo blocco:
-- ═══════════════════════════════════════════════
-- alter table profiles add column if not exists ai_calls_this_month int default 0;
-- alter table profiles add column if not exists refresh_batch_id text;
-- alter table profiles add column if not exists portfolio jsonb;
-- alter table tasks add column if not exists origin_kind text;
-- alter table tasks add column if not exists origin_ref text;
-- alter table theses add column if not exists challenge jsonb;
-- alter table theses add column if not exists signals jsonb;
--
-- ── Fase 1: track record delle tesi ──
-- alter table theses add column if not exists status text default 'active';
-- alter table theses add column if not exists accuracy float;
-- alter table theses add column if not exists signals_hit int default 0;
-- alter table theses add column if not exists signals_total int default 0;
-- alter table theses add column if not exists closed_at timestamptz;
-- alter table theses add column if not exists outcome_note text;
--
-- create table if not exists actions (
--   id uuid default gen_random_uuid() primary key,
--   user_id uuid references auth.users on delete cascade not null,
--   thesis_id uuid references theses on delete set null,
--   cluster_id text not null,
--   title text,
--   summary text,
--   categories jsonb,
--   caveat text,
--   performance jsonb,
--   performance_updated_at timestamptz,
--   pos_x float,
--   pos_y float,
--   created_at timestamptz default now()
-- );
-- alter table actions add column if not exists performance jsonb;
-- alter table actions add column if not exists performance_updated_at timestamptz;
-- alter table actions enable row level security;
-- drop policy if exists "own actions" on actions;
-- create policy "own actions" on actions for all using (auth.uid() = user_id);
--
-- create table if not exists shared_graphs (
--   id uuid default gen_random_uuid() primary key,
--   user_id uuid references auth.users on delete cascade not null unique,
--   token text unique not null,
--   title text,
--   snapshot jsonb not null,
--   created_at timestamptz default now(),
--   updated_at timestamptz default now()
-- );
-- alter table shared_graphs enable row level security;
-- drop policy if exists "own shared graphs" on shared_graphs;
-- create policy "own shared graphs" on shared_graphs for all using (auth.uid() = user_id);
--
-- create table if not exists watches (
--   id uuid default gen_random_uuid() primary key,
--   user_id uuid references auth.users on delete cascade not null,
--   task_id uuid references tasks on delete cascade not null,
--   query text not null,
--   last_stance text,
--   last_label text,
--   last_confidence text,
--   last_checked_at timestamptz default now(),
--   flip jsonb,
--   flip_seen boolean default false,
--   active boolean default true,
--   created_at timestamptz default now(),
--   unique(user_id, task_id)
-- );
-- alter table watches enable row level security;
-- drop policy if exists "own watches" on watches;
-- create policy "own watches" on watches for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════
-- SYNAPSE — Schema database
-- Esegui questo nel SQL Editor di Supabase
-- ═══════════════════════════════════════════════

-- ── PROFILI UTENTE ──
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  plan text default 'free',                    -- free | pro | team
  tasks_this_month int default 0,
  ai_calls_this_month int default 0,           -- memory/suggest/portfolio/challenge
  refresh_batch_id text,                       -- batch Anthropic pendente per il refresh tesi
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
  signals jsonb,                               -- {confirm:[...], invalidate:[...]}
  color text,
  pos_x float,
  pos_y float,
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
-- alter table theses add column if not exists challenge jsonb;
-- alter table theses add column if not exists signals jsonb;
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

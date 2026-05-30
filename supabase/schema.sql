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
  history jsonb default '[]',                  -- [{thesis, confidence, date}]
  color text,
  pos_x float,
  pos_y float,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════
-- ROW LEVEL SECURITY — ogni utente vede solo i suoi dati
-- ═══════════════════════════════════════════════

alter table profiles enable row level security;
alter table tasks enable row level security;
alter table connections enable row level security;
alter table theses enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id);

create policy "own tasks" on tasks
  for all using (auth.uid() = user_id);

create policy "own connections" on connections
  for all using (auth.uid() = user_id);

create policy "own theses" on theses
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
-- RESET MENSILE del contatore task (opzionale)
-- Da schedulare con pg_cron o manualmente
-- ═══════════════════════════════════════════════
-- update profiles set tasks_this_month = 0;

-- ============================================================================
-- VibeDuck — initial cloud schema (Supabase / Postgres)
-- ============================================================================
-- Run this in the Supabase SQL editor (or via the Supabase CLI). It sets up:
--   • user profiles linked to Supabase Auth (auth.users)
--   • per-user data tables (clipboard, tasks, projects, prompts, etc.)
--   • Row Level Security so each user can only read/write their own rows
--   • a trigger that auto-creates a profile row on sign-up
--
-- Registration/login itself is handled by Supabase Auth (email + password) from
-- the app — no custom users table or password handling is needed here.
-- Primary keys are TEXT so the client can generate ids locally (offline-first)
-- and upsert the same id to the cloud.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Reusable helper to keep updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles: one row per authenticated user
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create a profile automatically whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- clipboard_items: copy/paste history (the primary thing we sync)
-- ----------------------------------------------------------------------------
create table if not exists public.clipboard_items (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  category text not null default 'text',
  pinned boolean not null default false,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clipboard_user_created
  on public.clipboard_items (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- tasks
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms bigint not null default 0,
  prompt_used text,
  notes text,
  project_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_user on public.tasks (user_id);

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  folder text not null,
  framework text,
  languages jsonb not null default '[]'::jsonb,
  libraries jsonb not null default '[]'::jsonb,
  architecture_notes text,
  folder_structure text,
  coding_style text,
  current_goal text,
  known_bugs jsonb not null default '[]'::jsonb,
  todo_list jsonb not null default '[]'::jsonb,
  preferred_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_projects_user on public.projects (user_id);

-- ----------------------------------------------------------------------------
-- prompt_history
-- ----------------------------------------------------------------------------
create table if not exists public.prompt_history (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  original text not null,
  improved text,
  category text,
  tags jsonb not null default '[]'::jsonb,
  favorite boolean not null default false,
  score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_prompts_user on public.prompt_history (user_id);

-- ----------------------------------------------------------------------------
-- timeline (activity feed)
-- ----------------------------------------------------------------------------
create table if not exists public.timeline (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  label text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_timeline_user on public.timeline (user_id, occurred_at desc);

-- ----------------------------------------------------------------------------
-- achievements
-- ----------------------------------------------------------------------------
create table if not exists public.achievements (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  unlocked_at timestamptz,
  progress integer not null default 0,
  target integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_achievements_user_key
  on public.achievements (user_id, key);

-- ----------------------------------------------------------------------------
-- duck_state (the pet's persona/progression)
-- ----------------------------------------------------------------------------
create table if not exists public.duck_state (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Duck',
  skin text not null default 'classic',
  xp integer not null default 0,
  level integer not null default 1,
  accessories jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_duck_state_user on public.duck_state (user_id);

-- ----------------------------------------------------------------------------
-- sessions
-- ----------------------------------------------------------------------------
create table if not exists public.sessions (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sessions_user on public.sessions (user_id);

-- ----------------------------------------------------------------------------
-- daily_summary
-- ----------------------------------------------------------------------------
create table if not exists public.daily_summary (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  hours_coded real not null default 0,
  tasks_completed integer not null default 0,
  prompts_improved integer not null default 0,
  ai_requests integer not null default 0,
  clipboard_items integer not null default 0,
  lines_generated integer not null default 0,
  streak integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_daily_summary_user_date
  on public.daily_summary (user_id, date);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'clipboard_items', 'tasks', 'projects', 'prompt_history',
    'timeline', 'achievements', 'duck_state', 'sessions', 'daily_summary'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end;
$$;

-- ============================================================================
-- Row Level Security: every table is private to its owner.
-- ============================================================================
do $$
declare
  t text;
begin
  -- profiles uses `id` as the owner column; the rest use `user_id`.
  alter table public.profiles enable row level security;
  drop policy if exists "profiles_owner" on public.profiles;
  create policy "profiles_owner" on public.profiles
    using (auth.uid() = id) with check (auth.uid() = id);

  foreach t in array array[
    'clipboard_items', 'tasks', 'projects', 'prompt_history', 'timeline',
    'achievements', 'duck_state', 'sessions', 'daily_summary'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_owner" on public.%I;', t, t);
    execute format(
      'create policy "%s_owner" on public.%I
         using (auth.uid() = user_id) with check (auth.uid() = user_id);', t, t);
  end loop;
end;
$$;

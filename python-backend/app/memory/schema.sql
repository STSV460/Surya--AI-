create extension if not exists vector;

create table if not exists crew_memory_short (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  crew_name text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists crew_memory_short_user_idx on crew_memory_short (user_id, crew_name, created_at desc);
create index if not exists crew_memory_short_embedding_idx on crew_memory_short using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists crew_memory_long (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  crew_name text not null,
  task_name text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crew_memory_long_user_idx on crew_memory_long (user_id, crew_name, updated_at desc);

create table if not exists crew_memory_entity (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  entity_name text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crew_memory_entity_user_idx on crew_memory_entity (user_id, entity_name, updated_at desc);
create index if not exists crew_memory_entity_embedding_idx on crew_memory_entity using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists crew_templates (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  description text,
  template jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crew_templates_user_idx on crew_templates (user_id, updated_at desc);

create table if not exists crew_training_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  crew_name text not null,
  kind text not null check (kind in ('train', 'test')),
  status text not null,
  inputs jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists crew_training_runs_user_idx on crew_training_runs (user_id, created_at desc);

create table if not exists crew_task_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  run_id uuid,
  crew_name text not null,
  task_id text,
  agent text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crew_task_logs_user_idx on crew_task_logs (user_id, created_at desc);
create index if not exists crew_task_logs_run_idx on crew_task_logs (run_id, created_at asc);

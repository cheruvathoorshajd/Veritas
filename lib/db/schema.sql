-- Run this once in Supabase SQL editor

create extension if not exists "uuid-ossp";

create table sessions (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  input_mode  text not null check (input_mode in ('mic','file','text')),
  stage       text not null default 'idle',
  error       text,
  raw_transcript  jsonb default '[]',
  claims          jsonb default '[]',
  verdicts        jsonb default '[]',
  speakers        jsonb default '[]'
);

create index sessions_created_at_idx on sessions(created_at desc);

-- Row level security (optional, enable for multi-user)
alter table sessions enable row level security;
create policy "anon read own session" on sessions for select using (true);
create policy "anon insert session"   on sessions for insert with check (true);
create policy "anon update session"   on sessions for update using (true);

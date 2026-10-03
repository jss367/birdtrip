-- db/migrations/0001_profiles.sql
-- Apply manually via Supabase dashboard -> SQL Editor.
-- Idempotent: safe to re-run.

create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  life_list      jsonb        not null default '{}'::jsonb,
  targets        text         not null default '',
  ebird_token    text,
  preferences    jsonb        not null default '{}'::jsonb,
  updated_at     timestamptz  not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own row read" on public.profiles;
create policy "own row read"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "own row insert" on public.profiles;
create policy "own row insert"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "own row update" on public.profiles;
create policy "own row update"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.touch_profile_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

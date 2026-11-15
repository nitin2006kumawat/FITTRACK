create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_data_payload_object check (jsonb_typeof(payload) = 'object')
);

alter table public.user_data enable row level security;

revoke all on table public.user_data from anon;
grant select, insert, update, delete on table public.user_data to authenticated;

drop policy if exists "Users can read their own fitness data" on public.user_data;
create policy "Users can read their own fitness data"
  on public.user_data for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own fitness data" on public.user_data;
create policy "Users can create their own fitness data"
  on public.user_data for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own fitness data" on public.user_data;
create policy "Users can update their own fitness data"
  on public.user_data for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own fitness data" on public.user_data;
create policy "Users can delete their own fitness data"
  on public.user_data for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_user_data_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_data_updated_at on public.user_data;
create trigger set_user_data_updated_at
  before update on public.user_data
  for each row execute function public.set_user_data_updated_at();

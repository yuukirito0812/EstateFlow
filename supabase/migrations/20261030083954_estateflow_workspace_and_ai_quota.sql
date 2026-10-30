-- EstateFlow: all saved records belong to an authenticated account.
create table public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) < 2000000),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
revoke all on public.workspaces from public, anon;
grant select, insert, update on public.workspaces to authenticated;
create policy workspace_select on public.workspaces for select to authenticated
  using ((select auth.uid()) = user_id);
create policy workspace_insert on public.workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy workspace_update on public.workspaces for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.save_workspace(payload jsonb, expected_revision integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare saved_revision integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if expected_revision < 0 or expected_revision is null or payload is null then
    raise exception 'Invalid save' using errcode = '22023';
  end if;
  -- Revision zero is the only valid first save; updates compare atomically.
  if expected_revision = 0 then
    insert into public.workspaces (user_id, data, revision)
    values (auth.uid(), payload, 1)
    on conflict (user_id) do nothing returning revision into saved_revision;
  else
    update public.workspaces set data = payload, revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and revision = expected_revision
    returning revision into saved_revision;
  end if;
  return saved_revision;
end;
$$;
revoke all on function public.save_workspace(jsonb, integer) from public, anon;
grant execute on function public.save_workspace(jsonb, integer) to authenticated;

-- Quota state is outside the Data API. Its function derives the caller's ID.
create schema estateflow_private;
revoke all on schema estateflow_private from public, anon;
grant usage on schema estateflow_private to authenticated;
create table estateflow_private.ai_quota (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute bigint not null,
  count integer not null
);
alter table estateflow_private.ai_quota enable row level security;
revoke all on estateflow_private.ai_quota from public, anon, authenticated;
create function estateflow_private.consume_ai_quota()
returns boolean language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); current_minute bigint := floor(extract(epoch from now()) / 60); used integer;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into estateflow_private.ai_quota as quota (user_id, minute, count)
  values (caller, current_minute, 1)
  on conflict (user_id) do update set minute = excluded.minute,
    count = case when quota.minute = excluded.minute then quota.count + 1 else 1 end
  returning count into used;
  return used <= 8;
end;
$$;
revoke all on function estateflow_private.consume_ai_quota() from public, anon;
grant execute on function estateflow_private.consume_ai_quota() to authenticated;
create function public.consume_ai_quota()
returns boolean language sql security invoker set search_path = '' as $$
  select estateflow_private.consume_ai_quota();
$$;
revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;

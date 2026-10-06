-- PACE phase 2: safe mutual-like matching and chat policies.
-- Run after 0001_init.sql in Supabase.

create unique index if not exists matches_users_unique
on matches (least(user_a,user_b), greatest(user_a,user_b));

create or replace function public.create_match_if_mutual(p_to_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  match_id uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if me = p_to_user then raise exception 'invalid target'; end if;

  if exists (select 1 from blocks where (blocker=me and blocked=p_to_user) or (blocker=p_to_user and blocked=me)) then
    raise exception 'blocked';
  end if;

  if not exists (select 1 from likes where from_user=p_to_user and to_user=me) then
    return null;
  end if;

  insert into matches(user_a,user_b)
  values (least(me,p_to_user),greatest(me,p_to_user))
  on conflict (user_a,user_b) do nothing
  returning id into match_id;

  if match_id is null then
    select id into match_id from matches
    where user_a=least(me,p_to_user) and user_b=greatest(me,p_to_user);
  end if;
  return match_id;
end;
$$;

revoke all on function public.create_match_if_mutual(uuid) from public;
grant execute on function public.create_match_if_mutual(uuid) to authenticated;

create policy likes_target_select on likes
for select using (to_user = auth.uid() or from_user = auth.uid());

create policy matches_insert_party on matches
for insert with check (user_a = auth.uid() or user_b = auth.uid());

create policy messages_insert_party on messages
for insert with check (
  sender = auth.uid() and exists (
    select 1 from matches m
    where m.id=match_id and (m.user_a=auth.uid() or m.user_b=auth.uid())
  )
);

create policy reports_read_own on reports
for select using (reporter=auth.uid());

-- Realtime chat: enable the table in Supabase Dashboard > Database > Replication.

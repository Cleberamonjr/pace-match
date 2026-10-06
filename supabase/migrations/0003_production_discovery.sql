-- PACE production discovery, storage and mutual matching.
-- Run after 0002_matching_security.sql.

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update set public = true;

create policy "profile photos upload own"
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile photos update own"
on storage.objects for update to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile photos delete own"
on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.discover_profiles()
returns table (
  id uuid,
  name text,
  birth_date date,
  gender text,
  bio text,
  hobbies text[],
  area_label text,
  photo_url text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.birth_date, p.gender, p.bio, p.hobbies, p.area_label,
         (
           select storage.get_public_url('profile-photos', ph.storage_path)
           from photos ph
           where ph.user_id = p.id
           order by ph.position
           limit 1
         )
  from profiles p
  join preferences pref on pref.user_id = p.id
  where p.id <> auth.uid()
    and p.gender in (
      select unnest(seeking_genders)
      from preferences
      where user_id = auth.uid()
    )
    and extract(year from age(p.birth_date)) between
      (select age_min from preferences where user_id = auth.uid())
      and
      (select age_max from preferences where user_id = auth.uid())
    and not exists (
      select 1 from blocks b
      where (b.blocker = auth.uid() and b.blocked = p.id)
         or (b.blocker = p.id and b.blocked = auth.uid())
    )
    and not exists (
      select 1 from likes l
      where l.from_user = auth.uid() and l.to_user = p.id
    )
    and not exists (
      select 1 from matches m
      where (m.user_a = least(auth.uid(), p.id) and m.user_b = greatest(auth.uid(), p.id))
    )
  limit 100;
$$;

revoke all on function public.discover_profiles() from public;
grant execute on function public.discover_profiles() to authenticated;

create or replace function public.send_like_and_match(p_to_user uuid, p_kind text)
returns jsonb
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
  if p_kind not in ('like','super') then raise exception 'invalid like type'; end if;

  insert into likes(from_user,to_user,kind)
  values(me,p_to_user,p_kind)
  on conflict (from_user,to_user) do update set kind = excluded.kind, created_at = now();

  if exists (
    select 1 from likes
    where from_user = p_to_user and to_user = me
  ) then
    insert into matches(user_a,user_b)
    values(least(me,p_to_user),greatest(me,p_to_user))
    on conflict (user_a,user_b) do nothing;

    select id into match_id from matches
    where user_a=least(me,p_to_user) and user_b=greatest(me,p_to_user);

    return jsonb_build_object('matched', true, 'match_id', match_id);
  end if;

  return jsonb_build_object('matched', false, 'match_id', null);
end;
$$;

revoke all on function public.send_like_and_match(uuid,text) from public;
grant execute on function public.send_like_and_match(uuid,text) to authenticated;

create table if not exists passes (
  from_user uuid not null references profiles(id) on delete cascade,
  to_user uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user)
);

alter table passes enable row level security;
create policy passes_own on passes for all using (from_user = auth.uid()) with check (from_user = auth.uid());

create or replace function public.record_pass(p_to_user uuid)
returns void
language sql
security definer
set search_path = public
as $
  insert into passes(from_user,to_user)
  values(auth.uid(),p_to_user)
  on conflict do nothing;
$;
revoke all on function public.record_pass(uuid) from public;
grant execute on function public.record_pass(uuid) to authenticated;

alter table matches enable row level security;


create or replace function public.my_matches()
returns table (
  id uuid,
  name text,
  birth_date date,
  gender text,
  bio text,
  area_label text,
  photo_path text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id, p.name, p.birth_date, p.gender, p.bio, p.area_label,
    (
      select ph.storage_path
      from photos ph
      where ph.user_id = p.id
      order by ph.position
      limit 1
    )
  from matches m
  join profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  where m.user_a = auth.uid() or m.user_b = auth.uid()
  order by m.created_at desc;
$$;

revoke all on function public.my_matches() from public;
grant execute on function public.my_matches() to authenticated;

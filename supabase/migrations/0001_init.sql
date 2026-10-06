-- PACE initial schema. Apply in Supabase. Service role never ships to the client.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  birth_date date not null,
  gender text not null,
  bio text,
  hobbies text[] not null default '{}',
  area_label text,
  created_at timestamptz not null default now()
);

create table if not exists preferences (
  user_id uuid primary key references profiles (id) on delete cascade,
  seeking_genders text[] not null,
  age_min int not null,
  age_max int not null,
  radius_km int not null check (radius_km between 0 and 50),
  intention text,
  sport_matters boolean not null default false
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  storage_path text not null,
  position int not null,
  unique (user_id, position)
);

create table if not exists sport_profiles (
  user_id uuid primary key references profiles (id) on delete cascade,
  plays boolean not null default false,
  sport text,
  frequency text,
  level text,
  favorite_distance text,
  pace_seconds int
);

create table if not exists locations (
  user_id uuid primary key references profiles (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz not null default now()
);

create table if not exists likes (
  from_user uuid not null references profiles (id) on delete cascade,
  to_user uuid not null references profiles (id) on delete cascade,
  kind text not null check (kind in ('like', 'super')),
  created_at timestamptz not null default now(),
  primary key (from_user, to_user)
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles (id) on delete cascade,
  user_b uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  sender uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists blocks (
  blocker uuid not null references profiles (id) on delete cascade,
  blocked uuid not null references profiles (id) on delete cascade,
  primary key (blocker, blocked)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references profiles (id) on delete cascade,
  reported uuid not null references profiles (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete set null,
  name text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table preferences enable row level security;
alter table photos enable row level security;
alter table sport_profiles enable row level security;
alter table locations enable row level security;
alter table likes enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;
alter table analytics_events enable row level security;

create policy profiles_owner on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy photos_owner on photos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy prefs_owner on preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sport_owner on sport_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy location_owner on locations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy likes_own on likes for all using (from_user = auth.uid()) with check (from_user = auth.uid());
create policy matches_party on matches for select using (user_a = auth.uid() or user_b = auth.uid());
create policy messages_party on messages for select using (
  exists (select 1 from matches m where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid()))
);
create policy messages_send on messages for insert with check (sender = auth.uid());
create policy blocks_own on blocks for all using (blocker = auth.uid()) with check (blocker = auth.uid());
create policy reports_own on reports for insert with check (reporter = auth.uid());
create policy events_own on analytics_events for insert with check (user_id = auth.uid());

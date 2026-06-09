-- ═══════════════════════════════════════════════════════════
--  VIA — Initial Supabase schema
--
--  Tables:   profiles, checkins, journeys
--  Triggers: auto-create profile on auth signup
--  RLS:      public read, owner write (profiles + checkins)
--            read-only journeys (curated by admin for now)
--  Indexes:  user-feed, site-visit-count, recent-activity
--
--  Apply via Supabase dashboard → SQL editor → paste this file,
--  or via Supabase CLI: `supabase db push`
-- ═══════════════════════════════════════════════════════════

-- ── EXTENSIONS ───────────────────────────────────────────

create extension if not exists "pgcrypto";    -- gen_random_uuid
create extension if not exists "postgis";     -- ST_DWithin for "near me"

-- ── PROFILES ─────────────────────────────────────────────
-- Public profile keyed to the Supabase auth user. The auth.users table is
-- managed by Supabase; profiles extends it with VIA-specific fields.

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 40),
  avatar_url  text,
  bio         text check (length(bio) <= 280),
  created_at  timestamptz not null default now()
);

-- ── CHECKINS ─────────────────────────────────────────────
-- The core social object. One row per (user, site). User's *actual* GPS
-- position at check-in time is captured separately from the site's coords
-- so we can later prove "they were really there" and seed the near-me stage.

create table public.checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  site_pleiades  text not null,
  site_name      text not null,
  lat            numeric(9,6) not null,     -- canonical site coords
  lng            numeric(9,6) not null,
  user_lat       numeric(9,6),              -- traveler's GPS at check-in (optional)
  user_lng       numeric(9,6),
  note           text check (length(note) <= 500),
  photo_url      text,
  visited_at     timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (user_id, site_pleiades)
);

-- Indexes:
--   user feed (chronological)
create index checkins_user_recent_idx   on public.checkins (user_id, visited_at desc);
--   per-site visit counts + lists
create index checkins_site_idx          on public.checkins (site_pleiades);
--   global activity stream (realtime "X just checked in at Y")
create index checkins_global_recent_idx on public.checkins (created_at desc);

-- ── JOURNEYS ─────────────────────────────────────────────
-- Curated themed itineraries (Alexander's Campaign, Paul's Voyages, etc.)
-- Each journey is an ordered list of Pleiades ids. Waypoint order matters.

create table public.journeys (
  id          text primary key,                       -- e.g. "alexander"
  name        text not null,                          -- "Alexander's Campaign"
  era         text,                                   -- "334-323 BC"
  hero_text   text,                                   -- 1-2 sentence pitch
  color       text default '#d4a853',                 -- map path color
  waypoints   text[] not null,                        -- ordered Pleiades ids
  curator     text,                                   -- attribution
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── JOURNEY PROGRESS (function, not table) ───────────────
-- For a given user, return per-journey { visited, total } counts.
-- A function (not a view) so the client can pass auth.uid() implicitly.

create or replace function public.journey_progress(uid uuid)
returns table (
  journey_id        text,
  journey_name      text,
  waypoints_total   int,
  waypoints_visited int
)
language sql stable
as $$
  select
    j.id,
    j.name,
    array_length(j.waypoints, 1) as waypoints_total,
    (
      select count(*)::int
      from public.checkins c
      where c.user_id = uid
        and c.site_pleiades = any(j.waypoints)
    ) as waypoints_visited
  from public.journeys j
  where j.visible
$$;

-- ── ROW LEVEL SECURITY ───────────────────────────────────

alter table public.profiles enable row level security;
alter table public.checkins enable row level security;
alter table public.journeys enable row level security;

-- profiles: anyone can read; only the owner can write their row.
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update on public.profiles for update using (auth.uid() = id);

-- checkins: anyone can read (public social proof on the map);
-- only the owner can write/update/delete their own.
create policy checkins_read   on public.checkins for select using (true);
create policy checkins_insert on public.checkins for insert with check (auth.uid() = user_id);
create policy checkins_update on public.checkins for update using (auth.uid() = user_id);
create policy checkins_delete on public.checkins for delete using (auth.uid() = user_id);

-- journeys: read-only to everyone (admin curates via Supabase dashboard
-- for now; later a separate `curator` role gets insert/update).
create policy journeys_read on public.journeys for select using (visible);

-- ── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────
-- When a Supabase auth user is created, mint a matching profile so the
-- client never sees a missing-profile edge case.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1),
      'Traveler'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ── REALTIME ─────────────────────────────────────────────
-- Expose checkins to Supabase Realtime so the client can subscribe to
-- "someone just checked in nearby" without polling.

alter publication supabase_realtime add table public.checkins;

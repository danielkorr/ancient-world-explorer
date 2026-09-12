-- Research Lab contribution contract.
-- Proposals are separate from VIA core data and public chronology. The public
-- Data API may expose only accepted/archived records through RLS.

create table public.research_contributions (
  id                 uuid primary key default gen_random_uuid(),
  subject_kind       text not null check (subject_kind in ('site', 'road', 'alexander_stop', 'dossier')),
  subject_id         text not null check (length(trim(subject_id)) between 1 and 160),
  submission_type    text not null check (submission_type in (
    'claim-correction', 'new-evidence', 'field-observation',
    'interpretation', 'objection', 'research-lead'
  )),
  title              text not null check (length(trim(title)) between 1 and 180),
  proposal           text not null check (length(trim(proposal)) between 1 and 10000),
  rationale          text not null check (length(trim(rationale)) between 1 and 10000),
  provenance         text not null check (length(trim(provenance)) between 1 and 10000),
  contributor_id     uuid not null references auth.users(id) on delete cascade,
  contributor_context jsonb not null default '{}'::jsonb,
  status             text not null default 'proposed' check (status in (
    'proposed', 'triaged', 'under-review', 'accepted', 'disputed',
    'needs-more-research', 'withdrawn', 'archived'
  )),
  created_at         timestamptz not null default now()
);

create index research_contributions_subject_idx
  on public.research_contributions (subject_kind, subject_id, created_at desc);
create index research_contributions_status_idx
  on public.research_contributions (status, created_at desc);
create index research_contributions_contributor_idx
  on public.research_contributions (contributor_id, created_at desc);

create table public.research_contribution_evidence (
  id                uuid primary key default gen_random_uuid(),
  contribution_id   uuid not null references public.research_contributions(id) on delete cascade,
  evidence_type     text not null check (evidence_type in (
    'source', 'archaeological-record', 'photograph', 'map',
    'field-observation', 'inscription', 'other'
  )),
  title             text not null check (length(trim(title)) between 1 and 240),
  source_url        text,
  citation          text,
  provenance_kind   text not null default 'unknown' check (provenance_kind in (
    'firsthand', 'quoted', 'derivative', 'inferred', 'unknown'
  )),
  observed_at       timestamptz,
  latitude          numeric(9, 6),
  longitude         numeric(9, 6),
  location_precision text,
  notes             text check (length(notes) <= 10000),
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180),
  check (source_url is not null or citation is not null or notes is not null)
);

create index research_contribution_evidence_contribution_idx
  on public.research_contribution_evidence (contribution_id, created_at);

create table public.research_contribution_decisions (
  id                uuid primary key default gen_random_uuid(),
  contribution_id   uuid not null references public.research_contributions(id) on delete cascade,
  reviewer_id       uuid not null references auth.users(id) on delete cascade,
  decision          text not null check (decision in (
    'triage', 'accept', 'dispute', 'needs-more-research', 'withdraw', 'archive'
  )),
  rationale         text not null check (length(trim(rationale)) between 1 and 10000),
  reviewer_context  jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index research_contribution_decisions_contribution_idx
  on public.research_contribution_decisions (contribution_id, created_at desc);

alter table public.research_contributions enable row level security;
alter table public.research_contribution_evidence enable row level security;
alter table public.research_contribution_decisions enable row level security;

-- Public readers see only records that have reached an archival/publication
-- state. Contributors can see their own proposals while they are in review.
create policy research_contributions_public_read
  on public.research_contributions for select
  to anon, authenticated
  using (status in ('accepted', 'archived') or (select auth.uid()) = contributor_id);

create policy research_contributions_owner_insert
  on public.research_contributions for insert
  to authenticated
  with check ((select auth.uid()) = contributor_id and status = 'proposed');

-- No UPDATE or DELETE policies: the contribution record is append-only.

create policy research_evidence_read
  on public.research_contribution_evidence for select
  to anon, authenticated
  using (exists (
    select 1 from public.research_contributions c
    where c.id = contribution_id
      and (c.status in ('accepted', 'archived') or (select auth.uid()) = c.contributor_id)
  ));

create policy research_evidence_owner_insert
  on public.research_contribution_evidence for insert
  to authenticated
  with check (exists (
    select 1 from public.research_contributions c
    where c.id = contribution_id and (select auth.uid()) = c.contributor_id
  ));

-- Reviewer writes are intentionally unavailable until qualification and
-- independent peer-review authorization are implemented. Existing decisions
-- become public only through an accepted/archived contribution.
create policy research_decisions_read
  on public.research_contribution_decisions for select
  to anon, authenticated
  using (exists (
    select 1 from public.research_contributions c
    where c.id = contribution_id
      and (c.status in ('accepted', 'archived')
        or (select auth.uid()) = c.contributor_id
        or (select auth.uid()) = reviewer_id)
  ));

grant select on public.research_contributions to anon, authenticated;
grant insert on public.research_contributions to authenticated;
grant select on public.research_contribution_evidence to anon, authenticated;
grant insert on public.research_contribution_evidence to authenticated;
grant select on public.research_contribution_decisions to anon, authenticated;

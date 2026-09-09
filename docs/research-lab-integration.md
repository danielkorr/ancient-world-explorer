# Research Lab integration environments

Branch: `experiment/research-lab-production-integration`

This branch uses two deliberately separate database paths:

- **Local Supabase (Option C):** repeatable, synthetic fixtures for development,
  browser QA, and resettable integration tests.
- **Staging Supabase clone (Option A):** a separate hosted project for realistic,
  production-shaped read testing after a clone/restore is created manually in the
  Supabase dashboard. The live project is never used as a branch write target.

## Local stack

From the repository root:

```powershell
$env:NPM_CONFIG_CACHE = 'C:\tmp\awe-supabase-npm-cache'
npx --yes supabase@latest start
npx --yes supabase@latest db reset
npx --yes supabase@latest status
```

`supabase/migrations/0001_init.sql` applies the production-shaped social schema.
`supabase/seed.sql` adds only synthetic journey rows; it contains no users, tokens,
check-ins, or production content.

To exercise the main app against the local API, serve the repository and open the
page with `?backend=local`. Production remains the default when the parameter is
absent. The local publishable key is non-secret and is generated for this local
stack; never substitute a service-role or secret key in browser code.

## Staging clone gate

Before creating a hosted staging clone, verify:

1. The destination is a separate Supabase project/ref with separate credentials.
2. Profiles and auth users are anonymized or omitted; use dedicated test accounts.
3. Storage, Auth settings, Realtime, and any functions are reviewed separately after
   the database restore.
4. The merge branch receives only the staging URL and publishable key through a
   branch-specific configuration file or deployment setting.
5. No write path is enabled against the production project.

Research Lab review state remains isolated in `research-lab/.state`; it is not copied
into the social database and is not part of public chronology until the existing
promotion gates approve it.

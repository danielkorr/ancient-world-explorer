// ═══════════════════════════════════════════════════════════
//  VIA — Ancient World Explorer  |  config.js
//
//  Public Supabase credentials. Both are SAFE to commit:
//    - the URL is just an endpoint
//    - the publishable key (sb_publishable_*) is the new client-side
//      key, equivalent to the old `anon` JWT. RLS policies (see
//      supabase/migrations/0001_init.sql) are what actually protect
//      the data, not key secrecy.
//
//  NEVER commit a sb_secret_* / service_role key.
// ═══════════════════════════════════════════════════════════

window.VIA_CONFIG = {
  SUPABASE_URL: 'https://nqubatkwmosbsadmaugo.supabase.co',
  SUPABASE_KEY: 'sb_publishable_ZbK9rqINnuN6aabUH_nWSg_2C6I22Xe',
};

// ── Sibling-page URLs (the mode split) ──────────────────────
//  VIA ships as two focused pages on one origin: the Roman map at the
//  repo root, and Alexander's Campaign in the subfolder below. Each page
//  locks to one mode (window.VIA_LOCK_MODE, set inline per page) and the
//  cross-experience chips/links point at the sibling via these bases.
//  Kept here (shared config) so both generated pages agree on the URLs.
window.VIA_ROMAN_URL     = 'https://danielkorr.github.io/ancient-world-explorer/';
window.VIA_ALEXANDER_URL = 'https://danielkorr.github.io/ancient-world-explorer/alexander-the-great-campaigns/';

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

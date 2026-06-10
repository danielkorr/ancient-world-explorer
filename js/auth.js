// ═══════════════════════════════════════════════════════════
//  VIA — Ancient World Explorer  |  auth.js
//
//  Provider-agnostic auth + check-in layer for the social stage.
//
//  Today: backed by localStorage so the UI works offline / pre-backend.
//  Tomorrow: swap the LocalBackend below for a SupabaseBackend that hits
//  a Postgres `checkins` table and uses supabase.auth for identity. The
//  public surface (VIA.auth.*) should NOT change.
//
//  Data model (matches the future Supabase schema):
//    users:
//      id (uuid)
//      name (text)
//      created_at (timestamptz)
//    checkins:
//      id (uuid)
//      user_id (uuid, fk users)
//      site_pleiades (text, indexed)
//      site_name (text, denormalized for quick lists)
//      lat, lng (numeric, the actual coords used at check-in time)
//      note (text, nullable)
//      visited_at (timestamptz)
//      created_at (timestamptz)
// ═══════════════════════════════════════════════════════════

(function () {
  const LS_USER     = 'via.user';
  const LS_CHECKINS = 'via.checkins';

  // ── SUPABASE CLIENT (Phase 1: wired, not yet used) ─────
  // Initialize the global Supabase client if both the config and the
  // CDN-loaded `supabase` global are present. Phase 2 will introduce
  // a SupabaseBackend that uses this; for now we just expose it as
  // window.VIA_SB so the console / future code can reach it.
  try {
    const cfg = window.VIA_CONFIG;
    if (cfg && cfg.SUPABASE_URL && cfg.SUPABASE_KEY && window.supabase) {
      window.VIA_SB = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          lock: (_name, _timeout, fn) => fn(),
        },
      });
    }
  } catch (_) { /* silent — local mode still works without the client */ }

  // Manual magic-link hash handler. supabase-js 2.49.4's built-in
  // detectSessionInUrl and setSession both call getUser() internally,
  // which hangs forever on this project's ES256-signed tokens. Instead
  // we decode the JWT ourselves, write the full session shape directly
  // to localStorage in the format persistSession reads at boot, then
  // reload so the client picks it up via the proven path.
  try {
    const cfg = window.VIA_CONFIG;
    if (cfg && window.location.hash.includes('access_token=')) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const access_token  = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      const expires_in    = parseInt(params.get('expires_in'),  10) || 3600;
      const expires_at    = parseInt(params.get('expires_at'),  10) || (Math.floor(Date.now()/1000) + expires_in);
      if (access_token && refresh_token) {
        const b64 = access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
        const payload = JSON.parse(atob(pad));
        const user = {
          id:             payload.sub,
          email:          payload.email,
          aud:            payload.aud,
          role:           payload.role,
          app_metadata:   payload.app_metadata  || {},
          user_metadata:  payload.user_metadata || {},
          created_at:     new Date().toISOString(),
        };
        const session = { access_token, refresh_token, expires_in, expires_at, token_type: 'bearer', user };
        const projectRef = cfg.SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0];
        localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(session));
        // Strip the hash and reload so VIA_SB constructs with the token
        // already in storage. This avoids any setSession() code path.
        history.replaceState(null, '', window.location.pathname + window.location.search);
        location.reload();
      }
    }
  } catch (_) { /* silent */ }

  function uuid() {
    // Good-enough for local stage; backend will mint real uuids.
    return (crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
  }

  // ── LOCAL BACKEND ────────────────────────────────────────

  const LocalBackend = {
    name: 'local',

    currentUser() {
      try { return JSON.parse(localStorage.getItem(LS_USER)) || null; }
      catch { return null; }
    },

    signIn(name) {
      const trimmed = String(name || '').trim().slice(0, 40);
      if (!trimmed) throw new Error('Name required');
      const existing = this.currentUser();
      const user = existing && existing.name === trimmed
        ? existing
        : { id: uuid(), name: trimmed, created_at: new Date().toISOString() };
      localStorage.setItem(LS_USER, JSON.stringify(user));
      return user;
    },

    signOut() {
      localStorage.removeItem(LS_USER);
    },

    _readCheckins() {
      try { return JSON.parse(localStorage.getItem(LS_CHECKINS)) || []; }
      catch { return []; }
    },

    _writeCheckins(rows) {
      localStorage.setItem(LS_CHECKINS, JSON.stringify(rows));
    },

    checkIn(site, opts = {}) {
      const user = this.currentUser();
      if (!user) throw new Error('Not signed in');
      const rows = this._readCheckins();
      // De-dupe: one active check-in per user/site. Re-check-in updates timestamp.
      const idx = rows.findIndex(r =>
        r.user_id === user.id && r.site_pleiades === site.pleiades);
      const now = new Date().toISOString();
      const row = {
        id:            idx >= 0 ? rows[idx].id : uuid(),
        user_id:       user.id,
        site_pleiades: site.pleiades,
        site_name:     site.name,
        lat:           Number(site.lat),
        lng:           Number(site.lng),
        note:          opts.note || null,
        visited_at:    opts.visitedAt || now,
        created_at:    idx >= 0 ? rows[idx].created_at : now,
      };
      if (idx >= 0) rows[idx] = row; else rows.push(row);
      this._writeCheckins(rows);
      return row;
    },

    removeCheckIn(site) {
      const user = this.currentUser();
      if (!user) return;
      const rows = this._readCheckins()
        .filter(r => !(r.user_id === user.id && r.site_pleiades === site.pleiades));
      this._writeCheckins(rows);
    },

    getCheckin(site) {
      const user = this.currentUser();
      if (!user) return null;
      return this._readCheckins().find(r =>
        r.user_id === user.id && r.site_pleiades === site.pleiades) || null;
    },

    getUserCheckins() {
      const user = this.currentUser();
      if (!user) return [];
      return this._readCheckins().filter(r => r.user_id === user.id);
    },

    // Aggregate count across all "users" — locally this is just self, but the
    // call signature matches what a Supabase view would return.
    getSiteVisitCount(site) {
      return this._readCheckins().filter(r => r.site_pleiades === site.pleiades).length;
    },
  };

  // ── PUBLIC NAMESPACE ─────────────────────────────────────

  const listeners = new Set();
  function emit() { for (const fn of listeners) try { fn(); } catch {} }

  // ── SUPABASE BACKEND ─────────────────────────────────────
  // Same shape as LocalBackend. All operations are best-effort optimistic:
  // mutate the in-memory cache, emit() so the UI updates immediately, then
  // reconcile with Supabase asynchronously. On error we reload from the
  // server and emit again. The UI never has to await.
  //
  // Sign-in is the one exception — it sends a magic link, so the caller
  // sees a returned promise it can await or ignore. The auth state listener
  // below picks up the actual session once the user clicks the email link.

  const SupabaseBackend = {
    name: 'supabase',
    _user: null,
    _myCheckins: [],
    _siteCounts: new Map(),  // site_pleiades → count across all users
    _ready: false,

    async init() {
      const sb = window.VIA_SB;
      if (!sb) return;
      // Listener stays for future SIGNED_OUT / cross-tab events. Never
      // rely on it for boot hydration — INITIAL_SESSION doesn't fire
      // reliably on this project's ES256 tokens in supabase-js 2.49.4.
      sb.auth.onAuthStateChange(async (_event, session) => {
        if (_event === 'SIGNED_OUT') {
          this._user = null;
          this._myCheckins = [];
          emit();
          return;
        }
        if (session && session.user) {
          await this._loadProfile(session.user.id);
          await this._loadMyCheckins();
          emit();
        }
      });
      // Manual session hydration. sb.auth.getSession() wedges on ES256
      // tokens (calls getUser() internally, hangs forever). Decode the
      // persisted JWT ourselves — same pattern the magic-link hash handler
      // uses. Set _user immediately from the JWT so the pill paints on
      // the first frame; enhance from the profiles table in the background.
      // .from() queries still authenticate because supabase-js reads the
      // Authorization header from the same storage key.
      try {
        const cfg = window.VIA_CONFIG;
        const projectRef = cfg.SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0];
        const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
        if (raw) {
          const stored = JSON.parse(raw);
          const tok = stored && stored.access_token;
          if (tok) {
            const b64 = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
            const payload = JSON.parse(atob(pad));
            const nowSec = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp > nowSec) {
              // Optimistic _user from the JWT — pill renders immediately.
              const displayName = (payload.user_metadata && payload.user_metadata.name)
                || (payload.email && payload.email.split('@')[0])
                || 'Traveler';
              this._user = { id: payload.sub, name: displayName, email: payload.email };
              emit();
              // Background enhance — fill in profile row + checkins. If
              // the .from() queries fail, the optimistic _user stays.
              this._loadProfile(payload.sub).then(() => emit()).catch(() => {});
              this._loadMyCheckins().then(() => emit()).catch(() => {});
            } else {
              localStorage.removeItem(`sb-${projectRef}-auth-token`);
            }
          }
        }
      } catch (_) { /* signed-out fall-through */ }
      this._loadSiteCounts().then(() => emit()).catch(() => {});
      this._ready = true;
      emit();
    },

    currentUser() { return this._user; },

    async signIn(email) {
      const trimmed = String(email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        throw new Error('Enter an email to receive a sign-in link');
      }
      const { error } = await window.VIA_SB.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
      return { pending: true, email: trimmed };
    },

    async signOut() {
      // sb.auth.signOut() also wedges on ES256 tokens (hits getUser()
      // internally). Clear the stored session by hand, null local state,
      // emit, then reload so the next boot starts cleanly with no token.
      try {
        const cfg = window.VIA_CONFIG;
        const projectRef = cfg.SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0];
        localStorage.removeItem(`sb-${projectRef}-auth-token`);
      } catch (_) {}
      this._user = null;
      this._myCheckins = [];
      emit();
      // Fire-and-forget the supabase-side sign-out so the refresh token
      // gets invalidated server-side. We don't await — it may hang.
      try { window.VIA_SB.auth.signOut(); } catch (_) {}
      // Reload to drop any in-memory client state.
      setTimeout(() => location.reload(), 50);
    },

    async checkIn(site, opts = {}) {
      if (!this._user) throw new Error('Not signed in');
      const row = {
        user_id:       this._user.id,
        site_pleiades: site.pleiades,
        site_name:     site.name,
        lat:           Number(site.lat),
        lng:           Number(site.lng),
        user_lat:      opts.userLat ?? null,
        user_lng:      opts.userLng ?? null,
        note:          opts.note    ?? null,
        visited_at:    opts.visitedAt || new Date().toISOString(),
      };
      // Optimistic local cache update.
      const idx = this._myCheckins.findIndex(c => c.site_pleiades === site.pleiades);
      const cached = { id: 'pending', ...row, created_at: row.visited_at };
      if (idx >= 0) this._myCheckins[idx] = cached;
      else          this._myCheckins.push(cached);
      this._siteCounts.set(site.pleiades, (this._siteCounts.get(site.pleiades) || 0) + (idx >= 0 ? 0 : 1));
      emit();

      const { data, error } = await window.VIA_SB
        .from('checkins')
        .upsert(row, { onConflict: 'user_id,site_pleiades' })
        .select()
        .single();
      if (error) {
        // Roll back on failure by reloading from server.
        await this._loadMyCheckins();
        await this._loadSiteCounts();
        emit();
        throw error;
      }
      // Replace optimistic row with the server-confirmed one.
      const i = this._myCheckins.findIndex(c => c.site_pleiades === site.pleiades);
      if (i >= 0) this._myCheckins[i] = data;
      emit();
      return data;
    },

    async removeCheckIn(site) {
      if (!this._user) return;
      const before = this._myCheckins;
      this._myCheckins = this._myCheckins.filter(c => c.site_pleiades !== site.pleiades);
      if (before.length !== this._myCheckins.length) {
        this._siteCounts.set(site.pleiades, Math.max(0, (this._siteCounts.get(site.pleiades) || 1) - 1));
      }
      emit();
      const { error } = await window.VIA_SB
        .from('checkins')
        .delete()
        .eq('user_id', this._user.id)
        .eq('site_pleiades', site.pleiades);
      if (error) {
        await this._loadMyCheckins();
        await this._loadSiteCounts();
        emit();
      }
    },

    getCheckin(site) {
      if (!this._user) return null;
      return this._myCheckins.find(c => c.site_pleiades === site.pleiades) || null;
    },

    getUserCheckins() { return this._myCheckins.slice(); },

    getSiteVisitCount(site) {
      return this._siteCounts.get(site.pleiades) || 0;
    },

    async _loadProfile(userId) {
      const { data } = await window.VIA_SB
        .from('profiles')
        .select('id, name, avatar_url, bio, created_at')
        .eq('id', userId)
        .maybeSingle();
      // Merge: keep any optimistic fields (email, JWT-derived name) and
      // overlay the profile row on top. If no profile row exists, the
      // optimistic _user stays untouched.
      if (data) {
        this._user = { ...(this._user || { id: userId }), ...data };
      } else if (!this._user) {
        this._user = { id: userId, name: 'Traveler' };
      }
    },

    async _loadMyCheckins() {
      if (!this._user) { this._myCheckins = []; return; }
      const { data } = await window.VIA_SB
        .from('checkins')
        .select('*')
        .eq('user_id', this._user.id)
        .order('visited_at', { ascending: false });
      this._myCheckins = data || [];
    },

    async _loadSiteCounts() {
      // Phase 4 will switch this to a realtime subscription. For now, a
      // single fetch on boot + after every mutation is plenty.
      const { data } = await window.VIA_SB
        .from('checkins')
        .select('site_pleiades');
      const m = new Map();
      for (const row of (data || [])) {
        m.set(row.site_pleiades, (m.get(row.site_pleiades) || 0) + 1);
      }
      this._siteCounts = m;
    },
  };

  // ── BACKEND SELECTION ────────────────────────────────────
  // Default is Supabase whenever the client is available. Guest mode
  // (LocalBackend) is opt-in via `localStorage['via.guest']` or the URL
  // override `?guest=1`. The legacy `?cloud=1` / `via.use_supabase` flags
  // still force Supabase for backwards compatibility.

  function isGuest() {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('guest') === '1') return true;
      if (url.searchParams.get('cloud') === '1') return false;
    } catch {}
    try {
      if (localStorage.getItem('via.guest') === '1') return true;
      if (localStorage.getItem('via.use_supabase') === '1') return false;
    } catch {}
    return false;
  }

  function pickBackend() {
    if (!window.VIA_SB) return LocalBackend;
    return isGuest() ? LocalBackend : SupabaseBackend;
  }

  const backend = pickBackend();
  if (backend === SupabaseBackend) backend.init();

  // ── ONE-SHOT LOCAL → CLOUD IMPORT ────────────────────────
  // Reads localStorage checkins (written by any prior LocalBackend session
  // on this device) and upserts them under the currently signed-in cloud
  // user. Safe to call multiple times — the unique(user_id, site_pleiades)
  // constraint dedupes. Returns the number of rows imported.

  async function importLocalCheckins() {
    if (backend !== SupabaseBackend) return 0;
    const user = SupabaseBackend.currentUser();
    if (!user) return 0;
    let local = [];
    try { local = JSON.parse(localStorage.getItem(LS_CHECKINS) || '[]'); } catch {}
    if (!local.length) return 0;
    const rows = local.map(c => ({
      user_id:       user.id,
      site_pleiades: c.site_pleiades,
      site_name:     c.site_name,
      lat:           c.lat,
      lng:           c.lng,
      user_lat:      c.user_lat ?? null,
      user_lng:      c.user_lng ?? null,
      note:          c.note ?? null,
      visited_at:    c.visited_at || new Date().toISOString(),
    }));
    const { error } = await window.VIA_SB
      .from('checkins')
      .upsert(rows, { onConflict: 'user_id,site_pleiades' });
    if (error) throw error;
    // Reload cloud state so the UI reflects the merge.
    await SupabaseBackend._loadMyCheckins();
    await SupabaseBackend._loadSiteCounts();
    // Wipe local-only state — they're now in the cloud.
    try {
      localStorage.removeItem(LS_USER);
      localStorage.removeItem(LS_CHECKINS);
    } catch {}
    emit();
    return rows.length;
  }

  function localCheckinCount() {
    try { return (JSON.parse(localStorage.getItem(LS_CHECKINS) || '[]')).length; }
    catch { return 0; }
  }

  function enterGuestMode() {
    try { localStorage.setItem('via.guest', '1'); } catch {}
    // Force a reload so pickBackend() re-runs against LocalBackend.
    const url = new URL(window.location.href);
    url.searchParams.delete('signin');
    window.location.replace(url.toString());
  }

  function leaveGuestMode() {
    try { localStorage.removeItem('via.guest'); } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set('signin', '1');
    window.location.replace(url.toString());
  }

  window.VIA = window.VIA || {};
  window.VIA.auth = {
    backend:            backend.name,
    isGuest:            () => backend === LocalBackend && !!window.VIA_SB,
    currentUser:        () => backend.currentUser(),
    signIn:             v      => { const r = backend.signIn(v);      emit(); return r; },
    signOut:            ()     => { const r = backend.signOut();      emit(); return r; },
    checkIn:            (s, o) => { const r = backend.checkIn(s, o);  emit(); return r; },
    removeCheckIn:      s      => { const r = backend.removeCheckIn(s); emit(); return r; },
    getCheckin:         s      => backend.getCheckin(s),
    getUserCheckins:    ()     => backend.getUserCheckins(),
    getSiteVisitCount:  s      => backend.getSiteVisitCount(s),
    onChange:           fn     => { listeners.add(fn); return () => listeners.delete(fn); },
    importLocalCheckins,
    localCheckinCount,
    enterGuestMode,
    leaveGuestMode,
  };
})();

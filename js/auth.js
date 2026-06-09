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

  const backend = LocalBackend; // future: pick based on window.VIA_CONFIG?.supabase

  window.VIA = window.VIA || {};
  window.VIA.auth = {
    backend:           backend.name,
    currentUser:       () => backend.currentUser(),
    signIn:            name   => { const u = backend.signIn(name);   emit(); return u; },
    signOut:           ()     => { backend.signOut();                emit();         },
    checkIn:           (s, o) => { const r = backend.checkIn(s, o);  emit(); return r; },
    removeCheckIn:     s      => { backend.removeCheckIn(s);         emit();         },
    getCheckin:        s      => backend.getCheckin(s),
    getUserCheckins:   ()     => backend.getUserCheckins(),
    getSiteVisitCount: s      => backend.getSiteVisitCount(s),
    onChange:          fn     => { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();

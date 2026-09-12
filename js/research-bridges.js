// VIA historical-place bridge registry.
//
// This is intentionally data, not navigation logic. A bridge earns public
// visibility only when its identity join and Research Lab dossier are explicit.
// Pleiades remains the preferred identity anchor; narrative IDs are local to
// their respective experiences.
window.VIA_PLACE_BRIDGES = Object.freeze([
  Object.freeze({
    place_key: 'alexandria',
    pleiades: '727070',
    roman_site_id: 'alexandria',
    alexander_stop_id: 'alexandria-egypt',
    dossier: 'alexandria',
    relationship: 'same-place',
    confidence: 'high',
    public: true,
  }),
  Object.freeze({
    place_key: 'granicus',
    alexander_stop_id: 'granicus',
    dossier: 'granicus',
    relationship: 'campaign-place',
    confidence: 'high',
    public: true,
  }),
]);

// In-page deterministic journey for VIA, evaluated via `browse eval` against the
// ?qa=1 fixture. Runs entirely in the page (one browse process → one daemon →
// shared state), drives the app by intent through window.VIA.*, and returns a
// JSON verdict the shell runner asserts on. See tests/run-journeys.sh.
(function () {
  const fails = [];
  const ok = (name, cond) => { if (!cond) fails.push(name); };
  const V = window.VIA;
  const st = () => V.getState();

  // Boot / fixture sanity.
  ok('qa-mode-on',     V.qa === true);
  ok('catalogue-loaded', st().siteCount > 90);
  ok('boot-no-panel',  st().panelOpen === false);
  ok('boot-era-ancient', st().era === 'ancient');

  // Journey 1 — open a known curated site by id.
  ok('open-cumae',     V.openSite('cumae') === true);
  ok('cumae-panel-open', st().panelOpen === true);
  ok('cumae-name',     st().panelName === 'Cumae');

  // Journey 2 — open the first photo quest; assert quest UI + the email button.
  const q = V.firstQuestSite('photo');
  ok('photo-quest-exists', !!(q && q.id));
  if (q && q.id) V.openSite(q.id);
  ok('quest-banner-visible', st().questBannerVisible === true);
  const e = document.querySelector('[data-testid=panel-email]');
  const href = e ? e.getAttribute('href') : '';
  ok('email-is-mailto', href.indexOf('mailto:') === 0);
  ok('email-has-subject', /subject=/.test(href));
  const body = decodeURIComponent((href.split('body=')[1] || ''));
  ok('email-has-blurb', body.indexOf("What's VIA?") > -1);
  ok('email-no-dup-cta', (body.match(/closes the gap/g) || []).length <= 1);

  // Journey 3 — era toggle round-trips.
  V.setEra('modern');  ok('era-to-modern', st().era === 'modern');
  V.setEra('ancient'); ok('era-to-ancient', st().era === 'ancient');

  // Journey 4 — closing the panel.
  V.closePanel();      ok('panel-closes', st().panelOpen === false);

  return JSON.stringify({ failed: fails.length, fails });
})();

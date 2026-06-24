// In-page deterministic journey for VIA, evaluated via `browse eval` against the
// ?qa=1 fixture. Runs entirely in the page (one browse process -> one daemon ->
// shared state), drives the app by intent through window.VIA.*, and returns a
// JSON verdict the shell runner asserts on. See tests/run-journeys.sh.
(function () {
  const fails = [];
  const ok = (name, cond) => { if (!cond) fails.push(name); };
  const V = window.VIA;
  const st = () => V.getState();

  // Boot / fixture sanity.
  ok('qa-mode-on', V.qa === true);
  ok('catalogue-loaded', st().siteCount > 90);
  ok('boot-no-panel', st().panelOpen === false);
  ok('boot-era-ancient', st().era === 'ancient');

  const one = id => document.querySelector(`[data-testid="${id}"]`);
  ok('selector-main-nav', !!one('main-nav'));
  ok('selector-mobile-menu', !!one('mobile-menu-button'));
  ok('selector-map', !!one('map-container'));
  ok('selector-search-input', !!one('site-search-input'));
  ok('selector-search-results', !!one('site-search-results'));
  ok('selector-marker', !!one('site-marker'));
  ok('selector-layer-controls', !!one('layer-controls'));
  ok('selector-filter-panel', !!one('filter-panel'));
  ok('selector-tier-filters', document.querySelectorAll('[data-testid="site-tier-filter"]').length === 4);
  ok('selector-road-filters', document.querySelectorAll('[data-testid="road-certainty-filter"]').length === 3);

  // Journey 1 - search for and open a known curated site.
  const searchHits = V.searchSites('cumae');
  ok('search-has-cumae', Array.isArray(searchHits) && searchHits.length > 0);
  ok('search-opens-results', st().searchOpen === true && st().searchResultCount > 0);
  ok('search-first-hit-cumae', !!(searchHits[0] && searchHits[0].id === 'cumae'));
  ok('search-first-hit-site-group', !!(searchHits[0] && searchHits[0].bucket === 'site'));
  ok('search-previews-marker', st().searchPreviewSite === 'cumae');
  ok('select-cumae-from-search', V.selectSearchResult(0) === true);
  ok('cumae-panel-open', st().panelOpen === true);
  ok('cumae-name', st().panelName === 'Cumae');
  ok('search-closes-after-select', st().searchOpen === false);
  ok('search-input-filled', st().searchQuery === 'Cumae');
  ok('selector-selected-panel', !!one('selected-site-panel'));
  ok('selector-selected-title', one('selected-site-title')?.textContent === 'Cumae');
  ok('selector-selected-details', !!one('selected-site-details'));
  ok('selector-related-links', !!one('selected-site-related-links'));
  ok('selector-close-panel', !!one('close-selected-site-button'));

  // Journey 2 - open the first photo quest; assert quest UI + the email button.
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

  // Journey 3 - era toggle round-trips.
  V.setEra('modern'); ok('era-to-modern', st().era === 'modern');
  V.setEra('ancient'); ok('era-to-ancient', st().era === 'ancient');

  // Journey 4 - closing the panel.
  V.closePanel(); ok('panel-closes', st().panelOpen === false);

  // Journey 5 - detail slider widens the catalogue (curated -> all).
  V.setDetail(2); const allCount = st().visibleSiteCount;
  V.setDetail(0); const fewCount = st().visibleSiteCount;
  ok('detail-curated-subset', fewCount > 0 && fewCount < allCount);
  ok('detail-full-is-all', allCount === st().siteCount);

  // Journey 6 - subtractive tier filter: hiding a tier drops its markers (and
  // the slider can't bring them back); showing it again restores them.
  V.setDetail(2);
  const beforeHide = st().visibleSiteCount;
  V.toggleTier('photo');                 // hide the photo-quest tier
  const tf = st();
  ok('tier-hidden-in-state', tf.hiddenTiers.indexOf('photo') > -1);
  ok('tier-hide-reduces', tf.visibleSiteCount > 0 && tf.visibleSiteCount < beforeHide);
  V.toggleTier('photo');                 // bring it back
  const after = st();
  ok('tier-show-restores', after.hiddenTiers.length === 0 && after.visibleSiteCount === beforeHide);
  V.setDetail(0);

  // Journey 7 - share + email affordances are present (quest-modal share hub).
  ok('share-button-present', !!one('share-site-button'));
  ok('email-button-present', !!one('email-site-button'));

  return JSON.stringify({ failed: fails.length, fails });
})();

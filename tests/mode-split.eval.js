// In-page deterministic checks for the mode split (Phase 1) + Alexander guided
// journey (Phase 2), evaluated via `browse eval` against the ?qa=1 fixture at a
// specific lock state. The runner navigates to ?lock=roman|alexander|none and
// runs this once per state; the eval branches on window.VIA.getState().lockMode.
// Chrome visibility is asserted via getComputedStyle (the CSS lock rules are the
// contract), never bare DOM presence — a hidden element still exists.
(function () {
  const fails = [];
  const ok = (name, cond) => { if (!cond) fails.push(name); };
  const V = window.VIA;
  const st = () => V.getState();
  const cssDisp = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e).display : null; };
  const idDisp  = id  => { const e = document.getElementById(id); return e ? getComputedStyle(e).display : null; };
  // SITES / ALEXANDER_STOPS are script-scoped globals (top-level const), NOT on
  // window — reference them as bare globals through a typeof guard.
  const AS = (typeof ALEXANDER_STOPS !== 'undefined') ? ALEXANDER_STOPS : [];
  const SS = (typeof SITES !== 'undefined') ? SITES : [];

  const lock = st().lockMode;

  if (lock === 'roman') {
    ok('roman-page-mode', st().pageMode === 'roman');
    ok('roman-appmode', st().appMode === 'roman');
    ok('roman-body-class', document.body.classList.contains('lock-roman'));
    ok('roman-tabs-hidden', idDisp('mode-tabs') === 'none');
    ok('roman-crosslink-shown', idDisp('mode-crosslink') !== 'none');
    ok('roman-shows-to-alexander', cssDisp('.mode-cross.to-alexander') !== 'none');
    ok('roman-hides-to-roman', cssDisp('.mode-cross.to-roman') === 'none');
    ok('roman-welcome-variant',
      cssDisp('#welcome-body .wb-roman') === 'block' &&
      cssDisp('#welcome-body .wb-alexander') === 'none' &&
      cssDisp('#welcome-body .wb-dual') === 'none');
    ok('roman-key-namespaced', V.pageKey('via.welcomed') === 'via.welcomed.roman');
    // The Alexander cross-link chip must build a valid sibling deep-link.
    const stop = AS[0];
    if (stop) {
      const u = V.alexanderTwinUrl(stop.id) || '';
      ok('alex-twin-url-shape', /\?mode=alexander&alexander=/.test(u) && u.indexOf(stop.id) > -1);
    }

  } else if (lock === 'alexander') {
    ok('alex-page-mode', st().pageMode === 'alexander');
    ok('alex-appmode', st().appMode === 'alexander');
    ok('alex-body-class', document.body.classList.contains('lock-alexander'));
    ok('alex-tabs-hidden', idDisp('mode-tabs') === 'none');
    ok('alex-crosslink-shown', idDisp('mode-crosslink') !== 'none');
    ok('alex-shows-to-roman', cssDisp('.mode-cross.to-roman') !== 'none');
    ok('alex-hides-to-alexander', cssDisp('.mode-cross.to-alexander') === 'none');
    ok('alex-welcome-variant',
      cssDisp('#welcome-body .wb-alexander') === 'block' &&
      cssDisp('#welcome-body .wb-roman') === 'none' &&
      cssDisp('#welcome-body .wb-dual') === 'none');
    ok('alex-key-namespaced', V.pageKey('via.welcomed') === 'via.welcomed.alexander');
    // The Roman cross-link chip must build a valid sibling deep-link.
    const site = SS.find(s => s.pleiades);
    if (site) {
      const u = V.romanTwinUrl(site.id) || '';
      ok('roman-twin-url-shape', /\?site=/.test(u) && u.indexOf(String(site.pleiades)) > -1);
    }

    // ── Guided journey (Phase 2) ──
    const total = st().journeyCount;
    ok('journey-has-stops', total > 1);
    V.closePanel();
    ok('launcher-shown-at-rest', st().journeyLauncherShown === true);
    V.startJourney();
    ok('journey-start-index0', st().journeyIndex === 0);
    ok('journey-panel-open', st().panelOpen === true);
    ok('launcher-hidden-in-journey', st().journeyLauncherShown === false);
    V.journeyStep(1);
    ok('journey-next-advances', st().journeyIndex === 1);
    V.journeyStep(-1);
    ok('journey-prev-retreats', st().journeyIndex === 0);
    V.journeyStep(-1);
    ok('journey-clamps-at-start', st().journeyIndex === 0);   // linear, no wrap
    V.journeyGoTo(999999);
    ok('journey-clamps-at-end', st().journeyIndex === total - 1);
    // Phase jump lands on that phase's FIRST stop.
    const phaseKey = (AS.find(s => s.phase) || {}).phase;
    if (phaseKey) {
      V.journeyJumpPhase(phaseKey);
      const expect = AS.findIndex(s => s.phase === phaseKey);
      ok('journey-phase-jump-first', st().journeyIndex === expect);
    }
    V.closePanel();
    ok('launcher-returns-after-close', st().journeyLauncherShown === true);

  } else {
    // ?lock=none — the dev / back-compat state: both tabs, no cross-link.
    ok('none-lock-null', lock === null || lock === undefined);
    ok('none-tabs-shown', idDisp('mode-tabs') !== 'none');
    ok('none-crosslink-hidden', idDisp('mode-crosslink') === 'none');
    ok('none-roman-tab', !!document.querySelector('[data-testid="mode-roman"]'));
    ok('none-alexander-tab', !!document.querySelector('[data-testid="mode-alexander"]'));
    ok('none-welcome-dual', cssDisp('#welcome-body .wb-dual') !== 'none');
  }

  return JSON.stringify({ lock: lock === null ? 'none' : lock, failed: fails.length, fails });
})();

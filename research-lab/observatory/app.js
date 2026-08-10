(function () {
  'use strict';

  let report = null;
  let reviews = [];
  let reviewSyntheses = [];
  let selectedId = null;
  let activeMode = 'dossier';
  let queueSubjectId = null;
  let classificationFilter = 'all';
  let reviewFilter = 'all';
  let sourceQueueSubjectId = null;
  let sourceFamilyFilter = 'all';
  let sourceReviewFilter = 'all';

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function formatValue(value) {
    if (value === null || value === undefined) return '—';
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }

  function titleCase(value) {
    return String(value || '').replaceAll('_', ' ').replaceAll('-', ' ');
  }

  function evidenceStatusLabel(item) {
    if (item.source_type === 'scaife_cts' && item.status === 'verified') return 'citation resolved';
    return titleCase(item.status);
  }

  function sourceLinks(item) {
    if (item.source_type === 'scaife_cts') {
      const links = [];
      if (item.source_url) links.push({ label: 'Read passage', url: item.source_url });
      if (item.payload?.verification_url || item.verification_url) {
        links.push({ label: 'CTS verification record', url: item.payload?.verification_url || item.verification_url });
      }
      return links;
    }
    if (['open_context', 'open_context_candidate', 'open_context_search'].includes(item.source_type)) {
      const links = [];
      if (item.source_url) links.push({ label: item.source_type === 'open_context_search' ? 'View search results' : 'View archaeological record', url: item.source_url });
      const dataUrl = item.data_url || item.payload?.data_url;
      const citationUrl = item.citation_url || item.payload?.citation_url;
      if (dataUrl) links.push({ label: 'JSON-LD data', url: dataUrl });
      if (citationUrl) links.push({ label: 'Persistent citation', url: citationUrl });
      return links;
    }
    if (!item.source_url) return [];
    const labels = {
      pleiades: 'Pleiades authority record',
      pleiades_reference: 'Pleiades linked reference',
      wikidata: 'Wikidata authority record',
      wikidata_identity_candidate: 'Wikidata candidate record',
      wikidata_identity_search: 'Wikidata search results',
      wikimedia_commons: 'Wikimedia media record',
    };
    return [{ label: labels[item.source_type] || 'Open source record', url: item.source_url }];
  }

  function appendSourceLinks(root, item) {
    const links = sourceLinks(item);
    if (!links.length) return;
    const holder = el('span', 'source-links');
    links.forEach(({ label, url }) => {
      const link = el('a', '', label);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      holder.append(link);
    });
    root.append(holder);
  }

  function subjectFor(id) {
    return report.subjects.find((item) => item.id === id);
  }

  function reviewSynthesisFor(id) {
    return reviewSyntheses.find((item) => item.subject_id === id) || null;
  }

  function sourceFamily(item) {
    if (['scaife_cts', 'classical_citation'].includes(item.source_type)) return 'primary-sources';
    if (item.source_type === 'pleiades_reference') return 'modern-scholarship';
    if (item.source_type === 'pleiades' || item.source_type.startsWith('wikidata')) return 'authority-records';
    if (item.source_type === 'wikimedia_commons') return 'media-records';
    if (item.source_type.startsWith('open_context')) return 'archaeological-records';
    return 'geographic-and-other';
  }

  function sourceReviewOptions(item) {
    const family = sourceFamily(item);
    if (family === 'primary-sources') return [
      ['direct-support', 'Direct support'], ['contextual-support', 'Contextual support'], ['partial-support', 'Partial support'], ['not-relevant', 'Not relevant'], ['more-research', 'More research'],
    ];
    if (family === 'modern-scholarship') return [
      ['directly-relevant', 'Directly relevant'], ['useful-background', 'Useful background'], ['bibliographic-lead', 'Bibliographic lead'], ['outdated-superseded', 'Outdated / superseded'], ['not-relevant', 'Not relevant'], ['unable-to-access', 'Unable to access'], ['more-research', 'More research'],
    ];
    if (family === 'authority-records') return [
      ['correct-identity', 'Correct identity'], ['possible-identity', 'Possible identity'], ['incorrect-identity', 'Incorrect identity'], ['more-research', 'More research'],
    ];
    return [
      ['relevant', 'Relevant'], ['not-relevant', 'Not relevant'], ['unable-to-access', 'Unable to access'], ['more-research', 'More research'],
    ];
  }

  function formatYear(year) {
    if (!Number.isFinite(year)) return null;
    if (year < 0) return `${Math.abs(year)} BCE`;
    if (year === 0) return '1 BCE / 1 CE boundary';
    return `${year} CE`;
  }

  function chronologyLabel(chronology) {
    if (!chronology) return null;
    const early = formatYear(chronology.early_year);
    const late = formatYear(chronology.late_year);
    return early && late ? `${early}–${late}` : early || late;
  }

  function latestReview(targetType, targetId) {
    return [...reviews].reverse().find((item) =>
      (item.target_type || 'claim') === targetType && (item.target_id || item.claim_id) === targetId
    ) || null;
  }

  function summary() {
    const root = document.getElementById('run-summary');
    root.replaceChildren();
    const items = [
      ['Subjects', report.subjects.length],
      ['Dossiers', (report.dossiers || []).length],
      ['Claims', report.claims.length],
      ['Evidence', report.evidence.length],
      ['Conflicts', report.conflicts.length],
      ['Archaeology leads', (report.archaeology_leads || []).length],
    ];
    for (const [label, value] of items) {
      const box = el('div', 'metric');
      box.append(el('b', '', String(value)), el('span', '', label));
      root.append(box);
    }
  }

  function renderTabs() {
    document.querySelectorAll('.mode-tab').forEach((button) => {
      button.classList.toggle('active', button.dataset.mode === activeMode);
    });
  }

  function selectMode(mode) {
    activeMode = mode;
    renderTabs();
    renderSubjects();
    renderDetail();
  }

  function renderSubjects() {
    const root = document.getElementById('subject-list');
    root.replaceChildren();
    if (['archaeology', 'sources'].includes(activeMode)) {
      const selectedQueueId = activeMode === 'archaeology' ? queueSubjectId : sourceQueueSubjectId;
      const all = el('button', `subject-btn${selectedQueueId === null ? ' active' : ''}`, activeMode === 'archaeology' ? 'All discoveries' : 'All sources');
      all.type = 'button';
      all.append(el('small', '', activeMode === 'archaeology'
        ? `${(report.archaeology_leads || []).length} leads across ${report.subjects.length} stops`
        : `${report.evidence.length} evidence records across ${report.subjects.length} stops`));
      all.addEventListener('click', () => {
        if (activeMode === 'archaeology') queueSubjectId = null;
        else sourceQueueSubjectId = null;
        renderSubjects();
        renderDetail();
      });
      root.append(all);
    }
    for (const subject of report.subjects) {
      const active = activeMode === 'archaeology'
        ? subject.id === queueSubjectId
        : activeMode === 'sources'
          ? subject.id === sourceQueueSubjectId
          : subject.id === selectedId;
      const button = el('button', `subject-btn${active ? ' active' : ''}`, subject.name);
      button.type = 'button';
      button.dataset.testid = 'research-subject-row';
      button.append(el('small', '', `${subject.evidence_count} evidence · ${subject.archaeology_lead_count || 0} archaeology · ${subject.conflict_count} conflicts`));
      const synthesis = reviewSynthesisFor(subject.id);
      if (synthesis) button.append(el('small', 'subject-review-coverage', `${synthesis.coverage.overall.completion_percent}% human reviewed · ${synthesis.outstanding_work.length} outstanding`));
      button.addEventListener('click', () => {
        if (activeMode === 'archaeology') queueSubjectId = subject.id;
        else if (activeMode === 'sources') sourceQueueSubjectId = subject.id;
        else selectedId = subject.id;
        renderSubjects();
        renderDetail();
      });
      root.append(button);
    }
  }

  async function recordReview(targetType, targetId, decision, note) {
    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: targetType, target_id: targetId, decision, note }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Review failed');
    reviews.push(body);
    const synthesisResponse = await fetch('/api/review-syntheses');
    if (!synthesisResponse.ok) throw new Error('Review saved, but synthesis refresh failed');
    reviewSyntheses = await synthesisResponse.json();
    renderSubjects();
    renderDetail();
  }

  function reviewState(targetType, targetId) {
    const review = latestReview(targetType, targetId);
    if (!review) return null;
    const state = el('div', 'review-state', `Latest review: ${titleCase(review.decision)}`);
    if (review.note) state.append(document.createTextNode(` — ${review.note}`));
    return state;
  }

  function claimCard(item) {
    const evidence = item.evidence_ids.map((id) => report.evidence.find((e) => e.id === id)).filter(Boolean);
    const conflicts = item.conflict_ids.map((id) => report.conflicts.find((c) => c.id === id)).filter(Boolean);
    const card = el('article', 'claim');
    card.dataset.testid = 'research-claim';
    const top = el('div', 'claim-top');
    top.append(el('div', 'claim-field', item.field), el('div', `status ${item.status === 'disputed' ? 'disputed' : ''}`, item.status));
    card.append(top);

    const values = el('div', 'value-grid');
    for (const [label, value] of [['Existing', item.existing_value], ['Proposed', item.proposed_value]]) {
      const box = el('div', 'value');
      box.append(el('label', '', label), el('pre', '', formatValue(value)));
      values.append(box);
    }
    card.append(values);
    if (item.note) card.append(el('p', 'muted', item.note));
    for (const conflict of conflicts) card.append(el('div', 'conflict', conflict.description));

    if (evidence.length) {
      const list = el('ul', 'evidence');
      for (const ev of evidence) {
        const row = el('li', '', `${evidenceStatusLabel(ev)}: ${ev.assertion}`);
        appendSourceLinks(row, ev);
        if (ev.payload?.excerpt) row.append(el('blockquote', 'passage-excerpt', ev.payload.excerpt));
        list.append(row);
      }
      card.append(list);
    }

    const state = reviewState('claim', item.id);
    if (state) card.append(state);
    const actions = el('div', 'actions');
    for (const [decision, label] of [['accept', 'Accept'], ['reject', 'Reject'], ['more-research', 'More research']]) {
      const button = el('button', '', label);
      button.type = 'button';
      button.dataset.testid = `review-${decision}`;
      button.addEventListener('click', () => {
        actions.querySelectorAll('button').forEach((node) => { node.disabled = true; });
        recordReview('claim', item.id, decision, '').catch((error) => {
          actions.append(el('div', 'error', error.message));
          actions.querySelectorAll('button').forEach((node) => { node.disabled = false; });
        });
      });
      actions.append(button);
    }
    card.append(actions);
    return card;
  }

  function sourceReviewCard(item) {
    const card = el('article', 'claim source-review-card');
    card.dataset.testid = 'source-review-record';
    const subject = subjectFor(item.subject_id);
    const top = el('div', 'claim-top');
    top.append(
      el('div', 'claim-field', `${subject?.name || item.subject_id} · ${item.citation || item.title || titleCase(item.source_type)}`),
      el('div', 'status source-family', titleCase(sourceFamily(item))),
    );
    card.append(top);

    const facts = el('div', 'lead-facts');
    facts.append(el('span', '', `Record: ${titleCase(item.source_type)}`));
    facts.append(el('span', '', `Status: ${evidenceStatusLabel(item)}`));
    if (item.payload?.project) facts.append(el('span', '', `Project: ${item.payload.project}`));
    const chronology = chronologyLabel(item.payload && { early_year: item.payload.early_year, late_year: item.payload.late_year });
    if (chronology) facts.append(el('span', '', `Chronology: ${chronology}`));
    card.append(facts);
    const linkedClaims = report.claims.filter((claim) => claim.evidence_ids.includes(item.id));
    if (linkedClaims.length) {
      const claims = el('div', 'linked-claims');
      claims.append(el('div', 'section-eyebrow', 'LINKED RESEARCH CLAIMS'));
      linkedClaims.forEach((claim) => {
        claims.append(el('div', '', `${titleCase(claim.field)} — ${titleCase(claim.status)}: ${formatValue(claim.proposed_value)}`));
      });
      card.append(claims);
    }
    if (item.assertion) card.append(el('p', '', item.assertion));
    if (item.payload?.context) card.append(el('p', 'muted', `Context: ${item.payload.context}`));
    if (item.payload?.snippet) card.append(el('blockquote', 'passage-excerpt', item.payload.snippet));
    if (item.payload?.excerpt) card.append(el('blockquote', 'passage-excerpt', item.payload.excerpt));
    appendSourceLinks(card, item);

    const state = reviewState('evidence', item.id);
    if (state) card.append(state);
    const note = el('textarea', 'review-note');
    note.placeholder = 'Why does this source support, qualify, or fail to support the research record?';
    note.setAttribute('aria-label', `Source relevance note for ${item.citation || item.title}`);
    card.append(note);

    const actions = el('div', 'actions source-review-actions');
    for (const [decision, label] of sourceReviewOptions(item)) {
      const button = el('button', '', label);
      button.type = 'button';
      button.dataset.testid = `source-review-${decision}`;
      button.addEventListener('click', () => {
        actions.querySelectorAll('button').forEach((node) => { node.disabled = true; });
        recordReview('evidence', item.id, decision, note.value).catch((error) => {
          actions.append(el('div', 'error', error.message));
          actions.querySelectorAll('button').forEach((node) => { node.disabled = false; });
        });
      });
      actions.append(button);
    }
    const open = el('button', 'open-dossier', 'Open dossier');
    open.type = 'button';
    open.addEventListener('click', () => {
      selectedId = item.subject_id;
      selectMode('dossier');
    });
    actions.append(open);
    card.append(actions, el('p', 'muted', 'Source relevance is a reviewer judgment. It does not rewrite evidence status, confidence, or VIA core data.'));
    return card;
  }

  function archaeologyCard(item, { showSubject = false } = {}) {
    const card = el('article', 'archaeology-lead');
    card.dataset.testid = 'archaeology-lead';
    const top = el('div', 'claim-top');
    const label = showSubject ? `${subjectFor(item.subject_id)?.name || item.subject_id} · ${item.title}` : item.title;
    top.append(el('div', 'claim-field', label), el('div', `status archaeology-status ${item.classification}`, titleCase(item.classification)));
    card.append(top);

    const facts = el('div', 'lead-facts');
    facts.append(el('span', '', `Confidence ${item.confidence}/100`));
    if (Number.isFinite(item.distance_km)) facts.append(el('span', '', `${item.distance_km.toFixed(1)} km from VIA marker`));
    if (item.date) facts.append(el('span', '', `Published ${item.date}`));
    card.append(facts, el('p', '', item.relevance));
    if (item.rationale) card.append(el('p', 'muted', item.rationale));
    if (item.project) card.append(el('p', 'muted', `Project: ${item.project}`));
    if (item.context) card.append(el('p', 'muted', `Context: ${item.context}`));
    const chronology = chronologyLabel(item.chronology);
    if (chronology) card.append(el('p', 'muted', `Chronology: ${chronology}`));
    if (item.snippet) card.append(el('blockquote', 'passage-excerpt', item.snippet));
    appendSourceLinks(card, item);

    const state = reviewState('archaeology_lead', item.id);
    if (state) card.append(state);
    const note = el('textarea', 'review-note');
    note.placeholder = 'Reviewer note (chronology, context, provenance, next check…)';
    note.setAttribute('aria-label', `Review note for ${item.title}`);
    card.append(note);

    const actions = el('div', 'actions');
    for (const [decision, label] of [
      ['directly-relevant', 'Directly relevant'],
      ['contextually-relevant', 'Contextually relevant'],
      ['name-only-match', 'Name-only match'],
      ['geographically-unrelated', 'Geographically unrelated'],
      ['chronologically-incompatible', 'Chronologically incompatible'],
      ['insufficient-information', 'Insufficient information'],
      ['more-research', 'More research'],
    ]) {
      const button = el('button', '', label);
      button.type = 'button';
      button.dataset.testid = `archaeology-review-${decision}`;
      button.addEventListener('click', () => {
        actions.querySelectorAll('button').forEach((node) => { node.disabled = true; });
        recordReview('archaeology_lead', item.id, decision, note.value).catch((error) => {
          actions.append(el('div', 'error', error.message));
          actions.querySelectorAll('button').forEach((node) => { node.disabled = false; });
        });
      });
      actions.append(button);
    }
    const open = el('button', 'open-dossier', 'Open dossier');
    open.type = 'button';
    open.addEventListener('click', () => {
      selectedId = item.subject_id;
      selectMode('dossier');
    });
    actions.append(open);
    card.append(actions, el('p', 'muted', 'Review decisions are append-only research notes. They do not alter evidence classification or the core application.'));
    return card;
  }

  function subjectHead(subject, status) {
    const head = el('div', 'detail-head');
    const title = el('div');
    title.append(el('div', 'eyebrow', subject.core_id.toUpperCase()), el('h2', '', subject.name));
    if (subject.pleiades) title.append(el('div', 'muted', `Pleiades ${subject.pleiades}`));
    if (status) title.append(el('div', 'dossier-status', titleCase(status)));
    head.append(title);
    const scores = el('div', 'scores');
    const entries = [
      ['Confidence', subject.scores.scholarly_confidence],
      ['Completeness', subject.scores.research_completeness],
      ['Source quality', subject.scores.source_quality],
    ];
    for (const [label, value] of entries) {
      const score = el('div', 'score', `${label} `);
      score.append(el('b', '', String(value)));
      scores.append(score);
    }
    if (subject.scores.disputed) scores.append(el('div', 'score disputed', 'DISPUTED'));
    head.append(scores);
    return head;
  }

  function dossierListSection(title, items, renderItem, { wide = false } = {}) {
    const section = el('section', `dossier-section${wide ? ' wide' : ''}`);
    section.append(el('h3', '', title));
    if (!items.length) {
      section.append(el('p', 'muted', 'No items in the current research record.'));
      return section;
    }
    const list = el('ul');
    items.forEach((item) => list.append(el('li', '', renderItem(item))));
    section.append(list);
    return section;
  }

  function sourceSection(title, items) {
    const section = el('section', 'dossier-section');
    section.append(el('h3', '', title));
    if (!items.length) {
      section.append(el('p', 'muted', 'No sources in this category yet.'));
      return section;
    }
    for (const item of items) {
      const row = el('div', 'dossier-source');
      row.append(el('div', '', item.citation || item.title || item.assertion));
      row.append(el('div', 'muted', `${evidenceStatusLabel(item)} · ${titleCase(item.source_type)}`));
      appendSourceLinks(row, item);
      if (item.excerpt) row.append(el('blockquote', 'passage-excerpt', item.excerpt));
      const state = reviewState('evidence', item.evidence_id);
      if (state) row.append(state);
      section.append(row);
    }
    return section;
  }

  function coverageCard(label, coverage) {
    const card = el('div', 'coverage-card');
    const head = el('div', 'coverage-head');
    head.append(el('span', '', label), el('b', '', `${coverage.completion_percent}%`));
    const track = el('div', 'coverage-track');
    const fill = el('span', 'coverage-fill');
    fill.style.width = `${coverage.completion_percent}%`;
    track.append(fill);
    card.append(head, track, el('small', '', `${coverage.reviewed} of ${coverage.total} reviewed · ${coverage.unreviewed} unreviewed`));
    return card;
  }

  function assessmentSection(title, className, items, emptyMessage) {
    const section = el('section', `human-assessment ${className}`);
    section.append(el('h4', '', title));
    if (!items.length) {
      section.append(el('p', 'muted', emptyMessage));
      return section;
    }
    const list = el('ul');
    items.forEach((item) => {
      const row = el('li');
      row.append(el('span', 'assessment-type', titleCase(item.target_type)), document.createTextNode(` ${item.title}`));
      if (item.decision) row.append(el('small', '', titleCase(item.decision)));
      if (item.note) row.append(el('blockquote', 'reviewer-note', item.note));
      list.append(row);
    });
    section.append(list);
    return section;
  }

  function renderHumanSynthesis(subject) {
    const synthesis = reviewSynthesisFor(subject.id);
    const panel = el('section', 'human-synthesis');
    panel.dataset.testid = 'human-review-synthesis';
    const heading = el('div', 'human-synthesis-head');
    const title = el('div');
    title.append(el('div', 'section-eyebrow', 'HUMAN-REVIEWED DOSSIER SYNTHESIS'), el('h3', '', 'Scholarly review overlay'));
    heading.append(title);

    if (!synthesis) {
      panel.append(heading, el('p', 'muted', 'Human-review synthesis is unavailable. The machine-generated dossier remains unchanged.'));
      return panel;
    }

    const overall = el('div', 'overall-review', `${synthesis.coverage.overall.completion_percent}% reviewed`);
    heading.append(overall);
    panel.append(heading);
    panel.append(el('p', 'human-synthesis-note', 'This layer summarizes the latest human decisions in the append-only review log. It does not change machine confidence, generated findings, or VIA core data.'));

    const coverage = el('div', 'coverage-grid');
    coverage.append(
      coverageCard('All records', synthesis.coverage.overall),
      coverageCard('Sources', synthesis.coverage.sources),
      coverageCard('Archaeology', synthesis.coverage.archaeology),
      coverageCard('Claims', synthesis.coverage.claims),
    );
    panel.append(coverage);

    const assessmentGrid = el('div', 'assessment-grid');
    assessmentGrid.append(
      assessmentSection('Direct support', 'direct', synthesis.assessments.direct, 'No records have been judged direct support.'),
      assessmentSection('Qualified or contextual', 'qualified', synthesis.assessments.qualified, 'No qualified or contextual judgments yet.'),
      assessmentSection('Excluded from synthesis', 'excluded', synthesis.assessments.excluded, 'No records have been excluded.'),
      assessmentSection('Pending research', 'pending', synthesis.assessments.pending, 'No reviewed records are awaiting more research.'),
      assessmentSection('Unreviewed records', 'unreviewed', synthesis.assessments.unreviewed, 'All records in this dossier have a human decision.'),
    );
    panel.append(assessmentGrid);

    const status = synthesis.outstanding_work.length
      ? `${synthesis.outstanding_work.length} item${synthesis.outstanding_work.length === 1 ? '' : 's'} still require review or resolution.`
      : 'Human review is complete for the current dossier record set.';
    panel.append(el('p', synthesis.outstanding_work.length ? 'outstanding-status' : 'complete-status', status));
    return panel;
  }

  function renderDossier(root, subject) {
    const dossier = (report.dossiers || []).find((item) => item.subject_id === subject.id);
    if (!dossier) {
      root.append(subjectHead(subject), el('p', 'error', 'No dossier was generated for this subject. Re-run the research system.'));
      return;
    }
    root.append(subjectHead(subject, dossier.interpretive_status));
    root.append(el('div', 'machine-label', 'MACHINE-GENERATED RESEARCH SYNTHESIS'));
    root.append(el('p', 'dossier-synthesis', dossier.executive_synthesis));
    root.append(renderHumanSynthesis(subject));

    const grid = el('div', 'dossier-grid');
    grid.append(dossierListSection('Research priorities', dossier.research_priorities, (item) => item, { wide: true }));
    grid.append(dossierListSection('What we know', dossier.what_we_know, (item) => `${titleCase(item.field)} — ${titleCase(item.status)}: ${formatValue(item.value)}`));
    grid.append(sourceSection('Primary sources', dossier.primary_sources));
    grid.append(dossierListSection('Archaeological evidence', dossier.archaeological_evidence, (item) => `${item.title} — ${titleCase(item.classification)}, confidence ${item.confidence}/100. ${item.relevance}`));
    grid.append(sourceSection('Modern scholarship', dossier.modern_scholarship));
    grid.append(dossierListSection('Geographic evidence', dossier.geographic_evidence, (item) => `${item.title || item.assertion} — ${item.distance_km.toFixed(1)} km from VIA marker`));
    grid.append(dossierListSection('Competing interpretations', dossier.competing_interpretations, (item) => `${titleCase(item.field)} (${item.severity}): ${item.description}`));
    grid.append(dossierListSection('Unresolved questions', dossier.unresolved_questions, (item) => item, { wide: true }));
    root.append(grid);

    const provenance = el('details', 'provenance');
    provenance.append(el('summary', '', 'Dossier provenance IDs'), el('pre', '', JSON.stringify(dossier.provenance, null, 2)));
    root.append(provenance);
  }

  function renderClaims(root, subject) {
    root.append(subjectHead(subject));
    root.append(el('p', 'muted', 'Claim review records judgment in research state only. No accepted or rejected claim is promoted to the core application.'));
    report.claims.filter((item) => item.subject_id === subject.id).forEach((item) => root.append(claimCard(item)));
  }

  function archaeologyFilters(root) {
    const filters = el('div', 'filters');
    const classification = el('label', 'filter', 'Classification');
    const classificationSelect = el('select');
    for (const value of ['all', 'candidate_evidence', 'research_lead', 'disputed_interpretation', 'established_evidence']) {
      const option = el('option', '', titleCase(value));
      option.value = value;
      option.selected = value === classificationFilter;
      classificationSelect.append(option);
    }
    classificationSelect.addEventListener('change', () => { classificationFilter = classificationSelect.value; renderDetail(); });
    classification.append(classificationSelect);

    const review = el('label', 'filter', 'Review state');
    const reviewSelect = el('select');
    for (const value of ['all', 'unreviewed', 'reviewed']) {
      const option = el('option', '', titleCase(value));
      option.value = value;
      option.selected = value === reviewFilter;
      reviewSelect.append(option);
    }
    reviewSelect.addEventListener('change', () => { reviewFilter = reviewSelect.value; renderDetail(); });
    review.append(reviewSelect);
    filters.append(classification, review);
    root.append(filters);
  }

  function sourceFilters(root) {
    const filters = el('div', 'filters');
    const family = el('label', 'filter', 'Source family');
    const familySelect = el('select');
    for (const value of ['all', 'primary-sources', 'modern-scholarship', 'authority-records', 'archaeological-records', 'media-records', 'geographic-and-other']) {
      const option = el('option', '', titleCase(value));
      option.value = value;
      option.selected = value === sourceFamilyFilter;
      familySelect.append(option);
    }
    familySelect.addEventListener('change', () => { sourceFamilyFilter = familySelect.value; renderDetail(); });
    family.append(familySelect);

    const review = el('label', 'filter', 'Review state');
    const reviewSelect = el('select');
    for (const value of ['all', 'unreviewed', 'reviewed']) {
      const option = el('option', '', titleCase(value));
      option.value = value;
      option.selected = value === sourceReviewFilter;
      reviewSelect.append(option);
    }
    reviewSelect.addEventListener('change', () => { sourceReviewFilter = reviewSelect.value; renderDetail(); });
    review.append(reviewSelect);
    filters.append(family, review);
    root.append(filters);
  }

  function renderSourceQueue(root) {
    const head = el('div', 'queue-head');
    head.append(el('div', 'section-eyebrow', 'SOURCE RELEVANCE · HUMAN SCHOLARLY REVIEW'));
    head.append(el('h2', '', sourceQueueSubjectId ? `${subjectFor(sourceQueueSubjectId)?.name || 'Selected stop'} sources` : 'All source records'));
    head.append(el('p', 'muted', 'Assess whether each accessible record directly supports, contextualizes, merely mentions, or fails to support the research claim. Criteria adapt to the source family.'));
    sourceFilters(head);
    root.append(head);

    let sources = [...report.evidence];
    if (sourceQueueSubjectId) sources = sources.filter((item) => item.subject_id === sourceQueueSubjectId);
    if (sourceFamilyFilter !== 'all') sources = sources.filter((item) => sourceFamily(item) === sourceFamilyFilter);
    if (sourceReviewFilter !== 'all') {
      sources = sources.filter((item) => {
        const reviewed = Boolean(latestReview('evidence', item.id));
        return sourceReviewFilter === 'reviewed' ? reviewed : !reviewed;
      });
    }
    sources.sort((a, b) => {
      const subjectOrder = report.subjects.findIndex((item) => item.id === a.subject_id) - report.subjects.findIndex((item) => item.id === b.subject_id);
      return subjectOrder || sourceFamily(a).localeCompare(sourceFamily(b)) || String(a.title).localeCompare(String(b.title));
    });
    if (!sources.length) {
      root.append(el('div', 'queue-empty', 'No source records match the current review filters.'));
      return;
    }
    sources.forEach((item) => root.append(sourceReviewCard(item)));
  }

  function renderArchaeologyQueue(root) {
    const head = el('div', 'queue-head');
    head.append(el('div', 'section-eyebrow', 'ARCHAEOLOGICAL DISCOVERY · HUMAN REVIEW GATE'));
    head.append(el('h2', '', queueSubjectId ? `${subjectFor(queueSubjectId)?.name || 'Selected stop'} discoveries` : 'All discovery leads'));
    head.append(el('p', 'muted', 'Triage public-source matches for contextual relevance. Reviewer judgment is recorded separately from the discovery classification.'));
    archaeologyFilters(head);
    root.append(head);

    let leads = [...(report.archaeology_leads || [])];
    if (queueSubjectId) leads = leads.filter((item) => item.subject_id === queueSubjectId);
    if (classificationFilter !== 'all') leads = leads.filter((item) => item.classification === classificationFilter);
    if (reviewFilter !== 'all') {
      leads = leads.filter((item) => {
        const reviewed = Boolean(latestReview('archaeology_lead', item.id));
        return reviewFilter === 'reviewed' ? reviewed : !reviewed;
      });
    }
    leads.sort((a, b) => b.confidence - a.confidence);
    if (!leads.length) {
      root.append(el('div', 'queue-empty', 'No archaeological leads match the current review filters.'));
      return;
    }
    leads.forEach((item) => root.append(archaeologyCard(item, { showSubject: queueSubjectId === null })));
  }

  function renderDetail() {
    const root = document.getElementById('subject-detail');
    root.replaceChildren();
    if (activeMode === 'archaeology') {
      renderArchaeologyQueue(root);
      return;
    }
    if (activeMode === 'sources') {
      renderSourceQueue(root);
      return;
    }
    const subject = subjectFor(selectedId);
    if (!subject) return;
    if (activeMode === 'claims') renderClaims(root, subject);
    else renderDossier(root, subject);
  }

  document.querySelectorAll('.mode-tab').forEach((button) => {
    button.addEventListener('click', () => selectMode(button.dataset.mode));
  });

  Promise.all([
    fetch('/api/report').then((response) => response.ok ? response.json() : Promise.reject(new Error('Run the research system before opening the Observatory.'))),
    fetch('/api/reviews').then((response) => response.ok ? response.json() : []),
    fetch('/api/review-syntheses').then((response) => response.ok ? response.json() : []),
  ])
    .then(([data, reviewData, synthesisData]) => {
      report = data;
      reviews = reviewData;
      reviewSyntheses = synthesisData;
      const scope = document.getElementById('research-scope');
      scope.textContent = report.scope === 'all-38-alexander-stops' ? 'Alexander · all 38 stops' : 'Alexander · six-stop pilot';
      selectedId = report.subjects[0]?.id || null;
      summary();
      renderTabs();
      renderSubjects();
      renderDetail();
    })
    .catch((error) => {
      document.getElementById('subject-detail').replaceChildren(el('p', 'error', error.message));
    });
}());

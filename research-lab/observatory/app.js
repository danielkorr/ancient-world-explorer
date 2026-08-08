(function () {
  'use strict';

  let report = null;
  let reviews = [];
  let selectedId = null;
  let activeMode = 'dossier';
  let queueSubjectId = null;
  let classificationFilter = 'all';
  let reviewFilter = 'all';

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

  function subjectFor(id) {
    return report.subjects.find((item) => item.id === id);
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
    if (activeMode === 'archaeology') {
      const all = el('button', `subject-btn${queueSubjectId === null ? ' active' : ''}`, 'All discoveries');
      all.type = 'button';
      all.append(el('small', '', `${(report.archaeology_leads || []).length} leads across ${report.subjects.length} stops`));
      all.addEventListener('click', () => { queueSubjectId = null; renderSubjects(); renderDetail(); });
      root.append(all);
    }
    for (const subject of report.subjects) {
      const active = activeMode === 'archaeology' ? subject.id === queueSubjectId : subject.id === selectedId;
      const button = el('button', `subject-btn${active ? ' active' : ''}`, subject.name);
      button.type = 'button';
      button.dataset.testid = 'research-subject-row';
      button.append(el('small', '', `${subject.evidence_count} evidence · ${subject.archaeology_lead_count || 0} archaeology · ${subject.conflict_count} conflicts`));
      button.addEventListener('click', () => {
        if (activeMode === 'archaeology') queueSubjectId = subject.id;
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
        const row = el('li', '', `${ev.status}: ${ev.assertion}`);
        if (ev.source_url) {
          row.append(document.createTextNode(' '));
          const link = el('a', '', 'source');
          link.href = ev.source_url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          row.append(link);
        }
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
    if (item.source_url) {
      const source = el('a', 'lead-source', 'Open source record');
      source.href = item.source_url;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      card.append(source);
    }

    const state = reviewState('archaeology_lead', item.id);
    if (state) card.append(state);
    const note = el('textarea', 'review-note');
    note.placeholder = 'Reviewer note (chronology, context, provenance, next check…)';
    note.setAttribute('aria-label', `Review note for ${item.title}`);
    card.append(note);

    const actions = el('div', 'actions');
    for (const [decision, label] of [['relevant', 'Relevant'], ['not-relevant', 'Not relevant'], ['more-research', 'More research']]) {
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
      row.append(el('div', 'muted', `${titleCase(item.status)} · ${titleCase(item.source_type)}`));
      if (item.source_url) {
        const link = el('a', '', 'Open source');
        link.href = item.source_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        row.append(link);
      }
      section.append(row);
    }
    return section;
  }

  function renderDossier(root, subject) {
    const dossier = (report.dossiers || []).find((item) => item.subject_id === subject.id);
    if (!dossier) {
      root.append(subjectHead(subject), el('p', 'error', 'No dossier was generated for this subject. Re-run the research system.'));
      return;
    }
    root.append(subjectHead(subject, dossier.interpretive_status));
    root.append(el('p', 'dossier-synthesis', dossier.executive_synthesis));

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
    for (const value of ['all', 'unreviewed', 'relevant', 'not-relevant', 'more-research']) {
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
        const state = latestReview('archaeology_lead', item.id)?.decision || 'unreviewed';
        return state === reviewFilter;
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
  ])
    .then(([data, reviewData]) => {
      report = data;
      reviews = reviewData;
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

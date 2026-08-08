(function () {
  'use strict';
  let report = null;
  let selectedId = null;

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

  function summary() {
    const root = document.getElementById('run-summary');
    root.replaceChildren();
    const items = [
      ['Subjects', report.subjects.length],
      ['Claims', report.claims.length],
      ['Evidence', report.evidence.length],
      ['Conflicts', report.conflicts.length],
    ];
    for (const [label, value] of items) {
      const box = el('div', 'metric');
      box.append(el('b', '', String(value)), el('span', '', label));
      root.append(box);
    }
  }

  function renderSubjects() {
    const root = document.getElementById('subject-list');
    root.replaceChildren();
    for (const subject of report.subjects) {
      const button = el('button', `subject-btn${subject.id === selectedId ? ' active' : ''}`, subject.name);
      button.type = 'button';
      button.dataset.testid = 'research-subject-row';
      button.append(el('small', '', `${subject.evidence_count} evidence · ${subject.conflict_count} conflicts`));
      button.addEventListener('click', () => { selectedId = subject.id; renderSubjects(); renderDetail(); });
      root.append(button);
    }
  }

  async function review(claimId, decision, holder) {
    holder.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: claimId, decision, note: '' }),
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Review failed');
    holder.replaceChildren(el('div', 'reviewed', `Recorded: ${decision}. Research state only; core unchanged.`));
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

    const actions = el('div', 'actions');
    for (const [decision, label] of [['accept', 'Accept'], ['reject', 'Reject'], ['more-research', 'More research']]) {
      const button = el('button', '', label);
      button.type = 'button';
      button.dataset.testid = `review-${decision}`;
      button.addEventListener('click', () => review(item.id, decision, actions).catch((error) => {
        actions.append(el('div', 'error', error.message));
        actions.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      }));
      actions.append(button);
    }
    card.append(actions);
    return card;
  }

  function renderDetail() {
    const root = document.getElementById('subject-detail');
    root.replaceChildren();
    const subject = report.subjects.find((item) => item.id === selectedId);
    if (!subject) return;
    const head = el('div', 'detail-head');
    const title = el('div');
    title.append(el('div', 'eyebrow', subject.core_id.toUpperCase()), el('h2', '', subject.name));
    if (subject.pleiades) title.append(el('div', 'muted', `Pleiades ${subject.pleiades}`));
    head.append(title);
    const scores = el('div', 'scores');
    scores.append(
      el('div', 'score', `Confidence `),
      el('div', 'score', `Completeness `),
      el('div', 'score', `Source quality `),
    );
    const values = [subject.scores.scholarly_confidence, subject.scores.research_completeness, subject.scores.source_quality];
    [...scores.children].forEach((node, i) => node.append(el('b', '', String(values[i]))));
    if (subject.scores.disputed) scores.append(el('div', 'score disputed', 'DISPUTED'));
    head.append(scores);
    root.append(head);
    report.claims.filter((item) => item.subject_id === subject.id).forEach((item) => root.append(claimCard(item)));
  }

  fetch('/api/report')
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('Run the research pilot before opening the Observatory.')))
    .then((data) => {
      report = data;
      selectedId = report.subjects[0]?.id || null;
      summary();
      renderSubjects();
      renderDetail();
    })
    .catch((error) => {
      document.getElementById('subject-detail').replaceChildren(el('p', 'error', error.message));
    });
}());

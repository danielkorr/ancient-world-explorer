const DECISION_GROUPS = Object.freeze({
  direct: new Set(['accept', 'direct-support', 'directly-relevant', 'correct-identity', 'relevant']),
  qualified: new Set(['contextual-support', 'partial-support', 'contextually-relevant', 'useful-background', 'bibliographic-lead', 'possible-identity']),
  excluded: new Set(['reject', 'not-relevant', 'outdated-superseded', 'incorrect-identity', 'name-only-match', 'geographically-unrelated', 'chronologically-incompatible']),
  pending: new Set(['more-research', 'insufficient-information', 'unable-to-access']),
});

function completion(total, reviewed) {
  return {
    total,
    reviewed,
    unreviewed: total - reviewed,
    completion_percent: total ? Math.round((reviewed / total) * 100) : 100,
  };
}

function latestReviews(reviews) {
  const latest = new Map();
  for (const review of reviews || []) {
    const targetType = review.target_type || 'claim';
    const targetId = review.target_id || review.claim_id;
    if (targetId) latest.set(`${targetType}:${targetId}`, review);
  }
  return latest;
}

function decisionGroup(decision) {
  for (const [group, decisions] of Object.entries(DECISION_GROUPS)) {
    if (decisions.has(decision)) return group;
  }
  return 'pending';
}

function targetLabel(targetType, item) {
  if (targetType === 'claim') return `${item.field}: ${item.proposed_value ?? item.existing_value ?? 'unresolved'}`;
  return item.citation || item.title || item.assertion || item.id;
}

function targetSummary(targetType, item, review = null) {
  return {
    target_type: targetType,
    target_id: item.id,
    title: targetLabel(targetType, item),
    ...(item.field ? { field: item.field } : {}),
    ...(item.source_type ? { source_type: item.source_type } : {}),
    ...(review ? {
      decision: review.decision,
      assessment: decisionGroup(review.decision),
      note: review.note || '',
      at: review.at,
    } : {}),
  };
}

function subjectTargets(report, subjectId) {
  return [
    ...((report.claims || []).filter((item) => item.subject_id === subjectId).map((item) => ['claim', item])),
    ...((report.evidence || []).filter((item) => item.subject_id === subjectId).map((item) => ['evidence', item])),
    ...((report.archaeology_leads || []).filter((item) => item.subject_id === subjectId).map((item) => ['archaeology_lead', item])),
  ];
}

export function buildReviewSyntheses(report, reviews = []) {
  const latest = latestReviews(reviews);

  return (report.subjects || []).map((subject) => {
    const targets = subjectTargets(report, subject.id);
    const groups = { direct: [], qualified: [], excluded: [], pending: [], unreviewed: [] };
    const counts = {
      claim: { total: 0, reviewed: 0 },
      evidence: { total: 0, reviewed: 0 },
      archaeology_lead: { total: 0, reviewed: 0 },
    };

    for (const [targetType, item] of targets) {
      counts[targetType].total += 1;
      const review = latest.get(`${targetType}:${item.id}`);
      if (!review) {
        groups.unreviewed.push(targetSummary(targetType, item));
        continue;
      }
      counts[targetType].reviewed += 1;
      groups[decisionGroup(review.decision)].push(targetSummary(targetType, item, review));
    }

    const total = targets.length;
    const reviewed = counts.claim.reviewed + counts.evidence.reviewed + counts.archaeology_lead.reviewed;
    const reviewerNotes = [...groups.direct, ...groups.qualified, ...groups.excluded, ...groups.pending]
      .filter((item) => item.note)
      .map(({ target_type, target_id, title, decision, note, at }) => ({ target_type, target_id, title, decision, note, at }));
    const outstandingWork = [
      ...groups.pending.map((item) => ({ ...item, reason: 'pending-review-resolution' })),
      ...groups.unreviewed.map((item) => ({ ...item, reason: 'unreviewed' })),
    ];

    return {
      subject_id: subject.id,
      subject_name: subject.name,
      coverage: {
        overall: completion(total, reviewed),
        claims: completion(counts.claim.total, counts.claim.reviewed),
        sources: completion(counts.evidence.total, counts.evidence.reviewed),
        archaeology: completion(counts.archaeology_lead.total, counts.archaeology_lead.reviewed),
      },
      assessments: groups,
      reviewer_notes: reviewerNotes,
      outstanding_work: outstandingWork,
      safety: {
        machine_confidence_unchanged: true,
        core_write_path: false,
        promotion_to_core: 'not-implemented',
      },
    };
  });
}


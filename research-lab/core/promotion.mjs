import { temporalAssertion, TEMPORAL_REVIEW_STATUS } from './temporal.mjs';

export function reviewedTemporalAssertions(pilot, reviews = []) {
  return reviewedTemporalAssignmentEntries(pilot, reviews).map((entry) => entry.assertion);
}

function reviewedTemporalAssignmentEntries(pilot, reviews = []) {
  const latest = new Map();
  for (const review of reviews) {
    if (review.target_type === 'temporal_assertion') latest.set(review.target_id, review);
  }
  return (pilot?.assignments || []).map((assignment) => {
    const review = latest.get(assignment.annotation_id);
    if (!review || review.decision !== 'select-definition' || !String(review.note || '').trim()) return null;
    const candidate = assignment.candidates.find((item) => item.uri === review.selected_definition_uri);
    if (!candidate) return null;
    return {
      assignment,
      assertion: temporalAssertion({
        subjectId: assignment.subject_id,
        sourceTemporalExpression: assignment.source_temporal_expression,
        periodoDefinitionUri: candidate.uri,
        periodoLabel: candidate.labels[0] || assignment.source_temporal_expression,
        authority: candidate.authority_source,
        spatialScope: candidate.spatial_scope.map((item) => item.label),
        earliestYear: candidate.normalized_date_range?.earliest,
        latestYear: candidate.normalized_date_range?.latest,
        researcherInterpretation: review.note || 'Selected during the PeriodO pilot review.',
        assignmentConfidence: 'human-selected',
        reviewStatus: TEMPORAL_REVIEW_STATUS.HUMAN_REVIEWED,
        alternatives: assignment.candidates.filter((item) => item.uri !== candidate.uri).map((item) => item.uri),
      }),
    };
  }).filter(Boolean);
}

export function assertPilotReadyForPublicChronology(pilot, reviews = []) {
  const assignments = pilot?.assignments || [];
  const assertions = reviewedTemporalAssertions(pilot, reviews);
  if (!assignments.length || assertions.length !== assignments.length) {
    throw new Error(`Public chronology blocked: ${assignments.length - assertions.length} pilot assignment(s) still require human selection or resolution`);
  }
  return assertions;
}

export function assertPilotReadyForPartialPublicChronology(pilot, reviews = []) {
  const assignments = pilot?.assignments || [];
  const entries = reviewedTemporalAssignmentEntries(pilot, reviews);
  if (!entries.length) throw new Error('Partial public chronology blocked: no pilot assignment has a confirmed human selection');
  const reviewedIds = new Set(entries.map((entry) => entry.assignment.annotation_id));
  return {
    assertions: entries.map((entry) => entry.assertion),
    unresolved_assignments: assignments
      .filter((assignment) => !reviewedIds.has(assignment.annotation_id))
      .map(({ annotation_id, subject_id, source_temporal_expression }) => ({ annotation_id, subject_id, source_temporal_expression })),
  };
}

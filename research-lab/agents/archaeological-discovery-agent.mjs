import { ARCHAEOLOGY_POLICY } from '../config.mjs';
import { haversineKm } from '../core/geo.mjs';
import { archaeologyLead, ARCHAEOLOGY_CLASSIFICATION, evidence, EVIDENCE_STATUS } from '../core/schema.mjs';

function queryForStop(stop) {
  return String(stop.name || '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s+\/\s+/g, ' ')
    .replace(/\b(crossing|route)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(value) {
  return new Set(String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((word) => word.length > 2));
}

function rankRecord(stop, record) {
  const expected = wordSet(queryForStop(stop));
  const haystack = wordSet([record.label, record.context, record.project].filter(Boolean).join(' '));
  const overlap = [...expected].filter((word) => haystack.has(word)).length;
  const distance = record.coordinate ? haversineKm({ lat: stop.lat, lng: stop.lng }, record.coordinate) : null;
  let confidence = 20 + overlap * 18;
  if (distance !== null) confidence += distance <= 5 ? 35 : distance <= 25 ? 25 : distance <= 75 ? 15 : distance <= 200 ? 5 : -25;
  confidence = Math.max(5, Math.min(85, confidence));
  const classification = confidence >= 45 && (distance === null || distance <= 100)
    ? ARCHAEOLOGY_CLASSIFICATION.CANDIDATE
    : ARCHAEOLOGY_CLASSIFICATION.LEAD;
  return { distance, confidence, classification, overlap };
}

export async function runArchaeologicalDiscoveryAgent({ stop, subject, openContext }) {
  const query = queryForStop(stop);
  const evidenceItems = [];
  const leads = [];
  let searchUrl = null;
  try { searchUrl = openContext.searchPageUrl ? openContext.searchPageUrl(query, 8) : openContext.searchUrl(query, 8); } catch {}

  try {
    const result = await openContext.search(query, { rows: 8 });
    if (result.security?.prompt_injection_suspected) {
      evidenceItems.push(evidence({
        subjectId: subject.id,
        sourceType: 'open_context_search',
        sourceUrl: result.source_url,
        title: `Open Context search: ${query}`,
        assertion: 'Archaeological discovery response was quarantined because untrusted prompt-like text was detected.',
        status: EVIDENCE_STATUS.QUARANTINED,
        security: result.security,
      }));
      return { claims: [], evidence: evidenceItems, conflicts: [], leads };
    }

    for (const record of result.records) {
      const ranked = rankRecord(stop, record);
      const ev = evidence({
        subjectId: subject.id,
        sourceType: 'open_context_candidate',
        sourceUrl: record.source_url || result.source_url,
        title: record.label,
        assertion: 'Open Context returned this public archaeological record for the place-name search; relevance to Alexander is not established.',
        status: EVIDENCE_STATUS.UNRESOLVED,
        payload: {
          data_url: record.data_url,
          citation_url: record.citation_url,
          category: record.category,
          project: record.project,
          project_url: record.project_url,
          context: record.context,
          context_url: record.context_url,
          snippet: record.snippet,
          early_year: record.early_year,
          late_year: record.late_year,
          published: record.published,
          updated: record.updated,
          coordinate: record.coordinate,
        },
        security: record.security,
      });
      evidenceItems.push(ev);
      leads.push(archaeologyLead({
        subjectId: subject.id,
        classification: ranked.classification,
        sourceType: 'open_context',
        sourceUrl: record.source_url || result.source_url,
        dataUrl: record.data_url,
        citationUrl: record.citation_url,
        title: record.label,
        location: record.coordinate,
        date: record.published,
        snippet: record.snippet,
        project: record.project,
        context: record.context,
        chronology: record.early_year !== null || record.late_year !== null
          ? { early_year: record.early_year, late_year: record.late_year }
          : null,
        relevance: ranked.overlap
          ? `Place-name/context overlap (${ranked.overlap} token${ranked.overlap === 1 ? '' : 's'}); association requires scholarly review.`
          : 'Search-result proximity only; no name overlap detected.',
        confidence: ranked.confidence,
        distanceKm: ranked.distance,
        evidenceIds: [ev.id],
        rationale: ARCHAEOLOGY_POLICY.interpretation,
        sensitivity: ARCHAEOLOGY_POLICY.access,
      }));
    }

    if (!result.records.length) {
      evidenceItems.push(evidence({
        subjectId: subject.id,
        sourceType: 'open_context_search',
        sourceUrl: result.source_url,
        title: `Open Context search: ${query}`,
        assertion: 'No public Open Context records were returned for this discovery query.',
        status: EVIDENCE_STATUS.UNRESOLVED,
      }));
    }
  } catch (error) {
    evidenceItems.push(evidence({
      subjectId: subject.id,
      sourceType: 'open_context_search',
      sourceUrl: searchUrl,
      title: `Open Context search: ${query}`,
      assertion: `Archaeological discovery unavailable: ${error.message}`,
      status: EVIDENCE_STATUS.UNRESOLVED,
      payload: { query, policy: ARCHAEOLOGY_POLICY },
    }));
  }

  leads.sort((a, b) => b.confidence - a.confidence);
  return { claims: [], evidence: evidenceItems, conflicts: [], leads };
}

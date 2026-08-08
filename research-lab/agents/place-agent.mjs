import { claim, conflict, evidence, CLAIM_STATUS, EVIDENCE_STATUS } from '../core/schema.mjs';
import { haversineKm } from '../core/geo.mjs';

function normalizedWords(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter((word) => word.length > 2);
}

function authorityCandidateScore(stop, candidate, entity) {
  const expected = new Set(normalizedWords(stop.name));
  const found = new Set(normalizedWords(candidate.label));
  const overlap = [...expected].filter((word) => found.has(word)).length;
  const exact = String(stop.name || '').toLowerCase() === String(candidate.label || '').toLowerCase();
  const distance = entity?.coordinate ? haversineKm({ lat: stop.lat, lng: stop.lng }, entity.coordinate) : null;
  let score = 15 + overlap * 15 + (exact ? 25 : 0) + (entity?.pleiades ? 15 : 0);
  if (distance !== null) score += distance <= 5 ? 25 : distance <= 25 ? 18 : distance <= 100 ? 8 : -20;
  return { score: Math.max(0, Math.min(95, score)), distance };
}

async function discoverWikidataCandidates({ stop, subject, wikidata }) {
  const evidenceItems = [];
  const searchUrl = `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(stop.name)}`;
  try {
    const results = await wikidata.searchEntities(stop.name, 5);
    for (const candidate of results.slice(0, 3)) {
      let entity = null;
      try { entity = await wikidata.getEntity(candidate.id); } catch {}
      const ranked = authorityCandidateScore(stop, candidate, entity);
      const quarantined = candidate.security?.prompt_injection_suspected || entity?.security?.prompt_injection_suspected;
      evidenceItems.push(evidence({
        subjectId: subject.id,
        sourceType: 'wikidata_identity_candidate',
        sourceUrl: candidate.source_url,
        title: `${candidate.id}: ${candidate.label}`,
        assertion: 'Wikidata search candidate discovered for a stop lacking a Pleiades identity; it has not been accepted as the VIA place identity.',
        status: quarantined ? EVIDENCE_STATUS.QUARANTINED : EVIDENCE_STATUS.UNRESOLVED,
        payload: {
          id: candidate.id,
          label: candidate.label,
          description: candidate.description,
          pleiades: entity?.pleiades || null,
          coordinate: entity?.coordinate || null,
          distance_km: ranked.distance === null ? null : Number(ranked.distance.toFixed(3)),
          candidate_score: Math.round(ranked.score),
          auto_accept: false,
        },
        security: entity?.security || candidate.security,
      }));
    }
    if (!evidenceItems.length) {
      evidenceItems.push(evidence({
        subjectId: subject.id,
        sourceType: 'wikidata_identity_search',
        sourceUrl: searchUrl,
        title: `Wikidata search: ${stop.name}`,
        assertion: 'No authority candidate was returned; place identity remains unresolved.',
        status: EVIDENCE_STATUS.UNRESOLVED,
      }));
    }
  } catch (error) {
    evidenceItems.push(evidence({
      subjectId: subject.id,
      sourceType: 'wikidata_identity_search',
      sourceUrl: searchUrl,
      title: `Wikidata search: ${stop.name}`,
      assertion: `Authority discovery unavailable: ${error.message}`,
      status: EVIDENCE_STATUS.UNRESOLVED,
    }));
  }
  return evidenceItems;
}

export async function runPlaceAgent({ stop, subject, pleiades, wikidata }) {
  const claims = [];
  const evidenceItems = [];
  const conflicts = [];
  let pleiadesPlace = null;
  let wikidataEntity = null;

  if (!stop.pleiades) {
    const candidates = await discoverWikidataCandidates({ stop, subject, wikidata });
    evidenceItems.push(...candidates);
    claims.push(claim({
      subject,
      field: 'pleiades_identity',
      existingValue: null,
      status: CLAIM_STATUS.OBSERVED,
      agent: 'ancient-places-agent',
      evidence: candidates.map((item) => item.id),
      note: 'No Pleiades id is present in core data. Authority candidates may be surfaced for review, but the research lab will not guess or auto-accept one.',
    }));
    conflicts.push(conflict({
      subjectId: subject.id,
      field: 'place_identity',
      description: 'No machine-verifiable Pleiades identity is attached to this campaign stop.',
      severity: stop.certainty === 'disputed' ? 'high' : 'medium',
    }));
    return { claims, evidence: evidenceItems, conflicts, context: { pleiadesPlace, wikidataEntity, authorityCandidates: candidates } };
  }

  try {
    pleiadesPlace = await pleiades.getPlace(stop.pleiades);
    const quarantined = pleiadesPlace.security?.prompt_injection_suspected;
    const ev = evidence({
      subjectId: subject.id,
      sourceType: 'pleiades',
      sourceUrl: pleiadesPlace.source_url,
      title: `Pleiades ${pleiadesPlace.id}: ${pleiadesPlace.title}`,
      assertion: `VIA stop is linked to Pleiades ${pleiadesPlace.id}`,
      status: quarantined ? EVIDENCE_STATUS.QUARANTINED : EVIDENCE_STATUS.VERIFIED,
      payload: {
        id: pleiadesPlace.id,
        title: pleiadesPlace.title,
        names: pleiadesPlace.names,
        representative_point: pleiadesPlace.representative_point,
        wikidata: pleiadesPlace.wikidata,
        reference_count: pleiadesPlace.references?.length || 0,
      },
      security: pleiadesPlace.security,
    });
    evidenceItems.push(ev);
    claims.push(claim({
      subject,
      field: 'pleiades_identity',
      existingValue: String(stop.pleiades),
      status: ev.status === EVIDENCE_STATUS.VERIFIED ? CLAIM_STATUS.VERIFIED : CLAIM_STATUS.OBSERVED,
      agent: 'ancient-places-agent',
      evidence: [ev.id],
      note: quarantined ? 'Pleiades response was quarantined by content security.' : 'Pleiades record fetched successfully.',
    }));
  } catch (error) {
    evidenceItems.push(evidence({
      subjectId: subject.id,
      sourceType: 'pleiades',
      sourceUrl: `https://pleiades.stoa.org/places/${stop.pleiades}`,
      title: `Pleiades ${stop.pleiades}`,
      assertion: `Machine verification unavailable: ${error.message}`,
      status: EVIDENCE_STATUS.UNRESOLVED,
    }));
    claims.push(claim({
      subject,
      field: 'pleiades_identity',
      existingValue: String(stop.pleiades),
      status: CLAIM_STATUS.OBSERVED,
      agent: 'ancient-places-agent',
      evidence: evidenceItems.map((e) => e.id),
      note: 'Existing identifier retained, but live verification was unavailable.',
    }));
  }

  if (pleiadesPlace?.wikidata) {
    try {
      wikidataEntity = await wikidata.getEntity(pleiadesPlace.wikidata);
      const matchesPleiades = !wikidataEntity.pleiades || String(wikidataEntity.pleiades) === String(stop.pleiades);
      const ev = evidence({
        subjectId: subject.id,
        sourceType: 'wikidata',
        sourceUrl: wikidataEntity.source_url,
        title: `${wikidataEntity.id}: ${wikidataEntity.label}`,
        assertion: matchesPleiades ? 'Wikidata cross-reference is compatible with the VIA Pleiades id.' : 'Wikidata Pleiades cross-reference conflicts with VIA.',
        status: matchesPleiades ? EVIDENCE_STATUS.VERIFIED : EVIDENCE_STATUS.CONFLICTING,
        payload: { id: wikidataEntity.id, label: wikidataEntity.label, pleiades: wikidataEntity.pleiades },
        security: wikidataEntity.security,
      });
      evidenceItems.push(ev);
      if (!matchesPleiades) {
        conflicts.push(conflict({
          subjectId: subject.id,
          field: 'place_identity',
          description: `Wikidata ${wikidataEntity.id} points to Pleiades ${wikidataEntity.pleiades}, not ${stop.pleiades}.`,
          severity: 'high',
          evidenceIds: [ev.id],
        }));
      }
    } catch (error) {
      evidenceItems.push(evidence({
        subjectId: subject.id,
        sourceType: 'wikidata',
        sourceUrl: `https://www.wikidata.org/wiki/${pleiadesPlace.wikidata}`,
        title: pleiadesPlace.wikidata,
        assertion: `Machine verification unavailable: ${error.message}`,
        status: EVIDENCE_STATUS.UNRESOLVED,
      }));
    }
  }

  return { claims, evidence: evidenceItems, conflicts, context: { pleiadesPlace, wikidataEntity, authorityCandidates: [] } };
}

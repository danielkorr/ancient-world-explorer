import { claim, conflict, evidence, CLAIM_STATUS, EVIDENCE_STATUS } from '../core/schema.mjs';

export async function runPlaceAgent({ stop, subject, pleiades, wikidata }) {
  const claims = [];
  const evidenceItems = [];
  const conflicts = [];
  let pleiadesPlace = null;
  let wikidataEntity = null;

  if (!stop.pleiades) {
    claims.push(claim({
      subject,
      field: 'pleiades_identity',
      existingValue: null,
      status: CLAIM_STATUS.OBSERVED,
      agent: 'ancient-places-agent',
      note: 'No Pleiades id is present in core data. The research lab will not guess one.',
    }));
    conflicts.push(conflict({
      subjectId: subject.id,
      field: 'place_identity',
      description: 'No machine-verifiable Pleiades identity is attached to this campaign stop.',
      severity: stop.certainty === 'disputed' ? 'high' : 'medium',
    }));
    return { claims, evidence: evidenceItems, conflicts, context: { pleiadesPlace, wikidataEntity } };
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

  return { claims, evidence: evidenceItems, conflicts, context: { pleiadesPlace, wikidataEntity } };
}

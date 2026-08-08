import { claim, conflict, evidence, CLAIM_STATUS, EVIDENCE_STATUS } from '../core/schema.mjs';

function haversineKm(a, b) {
  const rad = (d) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function runGeospatialAgent({ stop, subject, pleiadesPlace = null, wikidataEntity = null }) {
  const claims = [];
  const evidenceItems = [];
  const conflicts = [];
  const corePoint = { lat: Number(stop.lat), lng: Number(stop.lng) };

  const refs = [];
  if (pleiadesPlace?.representative_point) refs.push({ source: 'pleiades', point: pleiadesPlace.representative_point, url: pleiadesPlace.source_url });
  if (wikidataEntity?.coordinate) refs.push({ source: 'wikidata', point: wikidataEntity.coordinate, url: wikidataEntity.source_url });

  for (const ref of refs) {
    const distanceKm = haversineKm(corePoint, ref.point);
    const ev = evidence({
      subjectId: subject.id,
      sourceType: ref.source,
      sourceUrl: ref.url,
      title: `${ref.source} coordinate comparison`,
      assertion: `External representative point is ${distanceKm.toFixed(2)} km from VIA marker`,
      status: EVIDENCE_STATUS.VERIFIED,
      payload: { core: corePoint, external: ref.point, distance_km: Number(distanceKm.toFixed(3)) },
    });
    evidenceItems.push(ev);
    if (distanceKm > 5) {
      conflicts.push(conflict({
        subjectId: subject.id,
        field: 'coordinates',
        description: `${ref.source} representative point differs from the VIA marker by ${distanceKm.toFixed(1)} km; do not auto-replace either point.`,
        severity: distanceKm > 25 ? 'high' : 'medium',
        evidenceIds: [ev.id],
      }));
    }
  }

  claims.push(claim({
    subject,
    field: 'coordinates',
    existingValue: corePoint,
    status: (stop.certainty === 'disputed' || conflicts.length) ? CLAIM_STATUS.DISPUTED : CLAIM_STATUS.OBSERVED,
    agent: 'geospatial-agent',
    evidence: evidenceItems.map((e) => e.id),
    conflicts: conflicts.map((c) => c.id),
    note: refs.length ? 'Compared with structured external representative points; no automatic coordinate replacement.' : 'No structured external coordinate available.',
  }));

  return { claims, evidence: evidenceItems, conflicts };
}

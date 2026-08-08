import { claim, evidence, CLAIM_STATUS, EVIDENCE_STATUS } from '../core/schema.mjs';

function commonsFilename(photo) {
  if (!photo?.source) return null;
  try {
    const url = new URL(photo.source);
    if (url.hostname !== 'commons.wikimedia.org') return null;
    const marker = '/wiki/File:';
    const i = url.pathname.indexOf(marker);
    return i >= 0 ? decodeURIComponent(url.pathname.slice(i + marker.length)).replace(/_/g, ' ') : null;
  } catch { return null; }
}

export async function runMediaAgent({ stop, subject, commons, wikidataEntity = null }) {
  const existing = stop.existing_photo || null;
  const candidate = wikidataEntity?.image || commonsFilename(existing);
  const evidenceItems = [];

  if (!candidate) {
    return {
      claims: [claim({
        subject,
        field: 'hero_image',
        existingValue: existing,
        status: CLAIM_STATUS.OBSERVED,
        agent: 'media-agent',
        note: 'No machine-resolvable Commons candidate was available.',
      })],
      evidence: [],
      conflicts: [],
    };
  }

  let verified = null;
  try {
    verified = await commons.getFile(candidate);
    evidenceItems.push(evidence({
      subjectId: subject.id,
      sourceType: 'wikimedia_commons',
      sourceUrl: verified.description_url,
      title: verified.filename,
      assertion: `Commons metadata reports license ${verified.license || 'unspecified'}.`,
      status: verified.security?.prompt_injection_suspected ? EVIDENCE_STATUS.QUARANTINED : EVIDENCE_STATUS.VERIFIED,
      payload: {
        filename: verified.filename,
        artist: verified.artist,
        credit: verified.credit,
        license: verified.license,
        license_url: verified.license_url,
      },
      security: verified.security,
    }));
  } catch (error) {
    evidenceItems.push(evidence({
      subjectId: subject.id,
      sourceType: 'wikimedia_commons',
      sourceUrl: existing?.source || null,
      title: candidate,
      assertion: `Image metadata verification unavailable: ${error.message}`,
      status: EVIDENCE_STATUS.UNRESOLVED,
    }));
  }

  const status = verified && evidenceItems[0]?.status === EVIDENCE_STATUS.VERIFIED
    ? CLAIM_STATUS.VERIFIED : CLAIM_STATUS.OBSERVED;
  return {
    claims: [claim({
      subject,
      field: 'hero_image',
      existingValue: existing,
      status,
      agent: 'media-agent',
      evidence: evidenceItems.map((e) => e.id),
      note: verified ? 'Existing/candidate image checked against Commons metadata; no automatic replacement.' : 'Image retained pending independent metadata verification.',
    })],
    evidence: evidenceItems,
    conflicts: [],
  };
}

const PLATO = 'https://w3id.org/plato#';

function iri(value, fallback) {
  return typeof value === 'string' && /^https?:\/\//.test(value) ? value : fallback;
}

export function buildPlatoExport({ places = [], datasetTitle = 'VIA Research Lab export', generatedAt = new Date().toISOString() } = {}) {
  const datasetId = 'https://via-ancient-world-explorer.example/research-lab/dataset';
  const things = [];
  const attestations = [];
  for (const place of places) {
    const placeId = iri(place.pleiades_uri, `https://pleiades.stoa.org/places/${place.pleiades}`);
    if (!place.pleiades || !/^\d+$/.test(String(place.pleiades))) continue;
    things.push({ '@id': placeId, '@type': `${PLATO}Thing`, 'plato:namespace': 'pleiades', 'plato:identifier': String(place.pleiades) });
    const attestation = {
      '@id': `urn:via:attestation:${String(place.pleiades)}`,
      '@type': `${PLATO}Attestation`, 'plato:attests_about': { '@id': placeId },
      'plato:sourced_by': { '@id': datasetId },
    };
    if (place.name) attestation['plato:attests_name'] = { '@type': `${PLATO}Name`, 'plato:toponym': String(place.name) };
    if (place.temporal_assertion) {
      const temporal = place.temporal_assertion;
      const timespan = { '@type': `${PLATO}Timespan`, 'plato:timespan_label': temporal.source_temporal_expression };
      if (temporal.periodo_definition_uri) timespan['plato:periodo_uri'] = temporal.periodo_definition_uri;
      if (temporal.normalized_date_range) timespan['plato:start_earliest'] = temporal.normalized_date_range.earliest;
      if (temporal.normalized_date_range) timespan['plato:end_latest'] = temporal.normalized_date_range.latest;
      attestation['plato:attests_timespan'] = timespan;
    }
    attestations.push(attestation);
  }
  return {
    '@context': { plato: PLATO },
    '@graph': [{ '@id': datasetId, '@type': `${PLATO}Dataset`, 'plato:title': datasetTitle, 'plato:generated_at': generatedAt }, ...things, ...attestations],
    export_metadata: { format: 'PLATO-oriented JSON-LD', generated_at: generatedAt, source_model: 'VIA Research Lab', note: 'Adapter output; not a public promotion or replacement for VIA internal records.' },
  };
}

const WORKS = Object.freeze([
  {
    match: /^Arrian\s+(.+)$/i,
    author: 'Arrian',
    work: 'Anabasis of Alexander',
    edition_urn: 'urn:cts:greekLit:tlg0074.tlg001.perseus-grc2',
    catalog_url: 'https://scaife.perseus.org/library/urn%3Acts%3AgreekLit%3Atlg0074.tlg001.perseus-grc2/',
  },
  {
    match: /^Plutarch,?\s+Alexander\s+(.+)$/i,
    author: 'Plutarch',
    work: 'Alexander',
    edition_urn: 'urn:cts:greekLit:tlg0007.tlg047.perseus-eng2',
    catalog_url: 'https://scaife.perseus.org/library/urn%3Acts%3AgreekLit%3Atlg0007.tlg047.perseus-eng2/',
  },
  {
    match: /^Diodorus\s+(.+)$/i,
    author: 'Diodorus Siculus',
    work: 'Historical Library',
    edition_urn: 'urn:cts:greekLit:tlg0060.tlg001.perseus-grc4',
    catalog_url: 'https://scaife.perseus.org/library/urn%3Acts%3AgreekLit%3Atlg0060.tlg001.perseus-grc4/',
  },
  {
    match: /^Curtius\s+(.+)$/i,
    author: 'Quintus Curtius Rufus',
    work: 'Historiarum Alexandri Magni',
    edition_urn: 'urn:cts:latinLit:phi0860.phi001.perseus-lat2',
    catalog_url: 'https://scaife.perseus.org/library/urn%3Acts%3AlatinLit%3Aphi0860.phi001.perseus-lat2/',
  },
]);

function normalizeRange(passage) {
  const match = String(passage).trim().match(/^([0-9]+(?:\.[0-9]+)*)-([0-9]+(?:\.[0-9]+)*)$/);
  if (!match) return String(passage).trim();
  const [, start, end] = match;
  if (end.includes('.') || !start.includes('.')) return `${start}-${end}`;
  const book = start.slice(0, start.lastIndexOf('.') + 1);
  return `${start}-${book}${end}`;
}

export function resolveClassicalCitation(citation) {
  const text = String(citation || '').trim();
  for (const work of WORKS) {
    const match = text.match(work.match);
    if (!match) continue;
    const passage = normalizeRange(match[1]);
    if (!/^[0-9]+(?:\.[0-9]+)*(?:-[0-9]+(?:\.[0-9]+)*)?$/.test(passage)) return null;
    return {
      citation: text,
      author: work.author,
      work: work.work,
      canonical_passage: passage,
      edition_urn: work.edition_urn,
      cts_urn: `${work.edition_urn}:${passage}`,
      catalog_url: work.catalog_url,
      resolution_basis: 'verified-edition-urn-plus-deterministic-canonical-reference',
    };
  }
  return null;
}

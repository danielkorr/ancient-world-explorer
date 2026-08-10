import assert from 'node:assert/strict';
import test from 'node:test';
import { runClassicalSourcesAgent } from '../agents/classical-sources-agent.mjs';
import { safeFetch } from '../connectors/http.mjs';
import { PleiadesConnector } from '../connectors/pleiades.mjs';
import { ScaifeConnector, scaifePassageExcerpt, scaifeReaderUrl, scaifeVerificationUrl } from '../connectors/scaife.mjs';
import { normalizeOpenContextRecord, OpenContextConnector } from '../connectors/open-context.mjs';
import { scoreSubject } from '../core/confidence.mjs';
import { subjectFromStop } from '../core/schema.mjs';

test('network connector rejects non-allowlisted hosts before fetching', async () => {
  await assert.rejects(safeFetch('https://example.com/pretend-source'), /allowlist/i);
});

test('source connectors validate identifiers before network access', async () => {
  await assert.rejects(new PleiadesConnector({ offline: true }).getPlace('../etc/passwd'), /invalid pleiades/i);
  await assert.rejects(new ScaifeConnector({ offline: true }).getPassage('Arrian 3.8'), /valid CTS URN/i);
});

test('Open Context discovery URL is constrained to the allowlisted JSON search API', () => {
  const connector = new OpenContextConnector({ offline: true });
  const url = new URL(connector.searchUrl('Pella', 8));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'opencontext.org');
  assert.equal(url.pathname, '/query/.json');
  assert.equal(url.searchParams.get('q'), 'Pella');
  assert.equal(url.searchParams.get('rows'), '8');
  const reader = new URL(connector.searchPageUrl('Pella', 8));
  assert.equal(reader.pathname, '/query/');
  assert.equal(reader.searchParams.get('q'), 'Pella');
});

test('Open Context records separate the human page, JSON-LD data, and persistent citation', () => {
  const record = normalizeOpenContextRecord({
    label: 'DEM-1982',
    uri: 'http://opencontext.org/subjects/e54594fc-ecef-445e-aa66-0947f44dbd70',
    href: 'https://opencontext.org/subjects/e54594fc-ecef-445e-aa66-0947f44dbd70',
    'citation uri': 'https://n2t.net/ark:/28722/r2p3k14c/dem_1982',
    'project label': 'Cross-referenced p3k14c',
    'project href': 'https://opencontext.org/projects/cdd78c10-e6da-42ef-9829-e792ce55bdd6',
    'context label': 'Europe/Greece/Central Macedonia',
    'context href': 'https://opencontext.org/subjects/25a28674-5040-4add-bca7-762f8eb917ff',
    'early bce/ce': -2846,
    'late bce/ce': -2472,
    snippet: 'Sample from <mark>Pella</mark>',
  });
  assert.equal(record.source_url, 'https://opencontext.org/subjects/e54594fc-ecef-445e-aa66-0947f44dbd70');
  assert.equal(record.data_url, 'https://opencontext.org/subjects/e54594fc-ecef-445e-aa66-0947f44dbd70.json');
  assert.equal(record.citation_url, 'https://n2t.net/ark:/28722/r2p3k14c/dem_1982');
  assert.equal(record.snippet, 'Sample from Pella');
  assert.deepEqual([record.early_year, record.late_year], [-2846, -2472]);

  const missing = normalizeOpenContextRecord({ label: 'Undated record', latitude: null, longitude: null, 'early bce/ce': null, 'late bce/ce': null });
  assert.equal(missing.coordinate, null);
  assert.deepEqual([missing.early_year, missing.late_year], [null, null]);
});

test('Scaife separates human-readable passage links from machine verification links', () => {
  const urn = 'urn:cts:greekLit:tlg0007.tlg047.perseus-eng2:3';
  assert.equal(scaifeReaderUrl(urn), `https://scaife.perseus.org/reader/${urn}`);
  assert.equal(
    scaifeVerificationUrl(urn),
    'https://scaife.perseus.org/library/urn%3Acts%3AgreekLit%3Atlg0007.tlg047.perseus-eng2%3A3/cts-api-xml/',
  );
  assert.equal(
    scaifePassageExcerpt('<GetPassage><reply><cts:passage><TEI><text><body><p>Alexander &amp; Philip</p></body></text></TEI></cts:passage></reply></GetPassage>'),
    'Alexander & Philip',
  );
});

test('classical-source claims distinguish citation resolution from historical verification', async () => {
  const stop = { id: 'pella', name: 'Pella', ancient_sources: ['Plutarch, Alexander 3'] };
  const subject = subjectFromStop(stop);
  const urn = 'urn:cts:greekLit:tlg0007.tlg047.perseus-eng2:3';
  const scaife = {
    async getPassage() {
      return {
        reader_url: scaifeReaderUrl(urn),
        verification_url: scaifeVerificationUrl(urn),
        excerpt: 'Alexander was born at Pella.',
        security: { prompt_injection_suspected: false },
      };
    },
  };
  const result = await runClassicalSourcesAgent({ stop, subject, scaife });
  assert.equal(result.claims[0].status, 'observed');
  assert.match(result.claims[0].note, /not the historical claim/i);
  assert.equal(result.evidence[0].status, 'verified');
  assert.equal(result.evidence[0].source_url, scaifeReaderUrl(urn));
  assert.equal(result.evidence[0].payload.verification_scope, 'citation-resolution');
  assert.equal(result.evidence[0].payload.verification_url, scaifeVerificationUrl(urn));
  const withoutEvidence = scoreSubject({ claims: result.claims, evidence: [], conflicts: [] });
  const withResolvedCitation = scoreSubject({ claims: result.claims, evidence: result.evidence, conflicts: [] });
  assert.equal(withResolvedCitation.scholarly_confidence, withoutEvidence.scholarly_confidence);
  assert.equal(withResolvedCitation.source_quality, withoutEvidence.source_quality);
});

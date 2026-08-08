import assert from 'node:assert/strict';
import test from 'node:test';
import { safeFetch } from '../connectors/http.mjs';
import { PleiadesConnector } from '../connectors/pleiades.mjs';
import { ScaifeConnector } from '../connectors/scaife.mjs';
import { OpenContextConnector } from '../connectors/open-context.mjs';

test('network connector rejects non-allowlisted hosts before fetching', async () => {
  await assert.rejects(safeFetch('https://example.com/pretend-source'), /allowlist/i);
});

test('source connectors validate identifiers before network access', async () => {
  await assert.rejects(new PleiadesConnector({ offline: true }).getPlace('../etc/passwd'), /invalid pleiades/i);
  await assert.rejects(new ScaifeConnector({ offline: true }).getPassage('Arrian 3.8'), /valid CTS URN/i);
});

test('Open Context discovery URL is constrained to the allowlisted JSON search API', () => {
  const url = new URL(new OpenContextConnector({ offline: true }).searchUrl('Pella', 8));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'opencontext.org');
  assert.equal(url.pathname, '/query/.json');
  assert.equal(url.searchParams.get('q'), 'Pella');
  assert.equal(url.searchParams.get('rows'), '8');
});

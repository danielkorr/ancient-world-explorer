import assert from 'node:assert/strict';
import test from 'node:test';
import { safeFetch } from '../connectors/http.mjs';
import { PleiadesConnector } from '../connectors/pleiades.mjs';
import { ScaifeConnector } from '../connectors/scaife.mjs';

test('network connector rejects non-allowlisted hosts before fetching', async () => {
  await assert.rejects(safeFetch('https://example.com/pretend-source'), /allowlist/i);
});

test('source connectors validate identifiers before network access', async () => {
  await assert.rejects(new PleiadesConnector({ offline: true }).getPlace('../etc/passwd'), /invalid pleiades/i);
  await assert.rejects(new ScaifeConnector({ offline: true }).getPassage('Arrian 3.8'), /valid CTS URN/i);
});

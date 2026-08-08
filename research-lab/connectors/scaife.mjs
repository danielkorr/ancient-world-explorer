import { safeFetchText } from './http.mjs';

export class ScaifeConnector {
  constructor({ offline = false } = {}) { this.offline = offline; }

  async getPassage(ctsUrn) {
    const urn = String(ctsUrn || '').trim();
    if (!/^urn:cts:[A-Za-z0-9_.:-]+$/.test(urn)) throw new Error('A valid CTS URN is required');
    const url = `https://scaife.perseus.org/library/${encodeURIComponent(urn)}/cts-api-xml/`;
    const result = await safeFetchText(url, { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1', offline: this.offline });
    return {
      urn,
      source_url: `https://scaife.perseus.org/library/${encodeURIComponent(urn)}/`,
      xml: result.text.slice(0, 50000),
      fetched_url: result.finalUrl,
      security: result.security,
    };
  }
}

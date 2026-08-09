import { safeFetchText } from './http.mjs';

const CTS_URN = /^urn:cts:[A-Za-z0-9_.:-]+$/;

function validatedUrn(ctsUrn) {
  const urn = String(ctsUrn || '').trim();
  if (!CTS_URN.test(urn)) throw new Error('A valid CTS URN is required');
  return urn;
}

export function scaifeReaderUrl(ctsUrn) {
  return `https://scaife.perseus.org/reader/${validatedUrn(ctsUrn)}`;
}

export function scaifeVerificationUrl(ctsUrn) {
  return `https://scaife.perseus.org/library/${encodeURIComponent(validatedUrn(ctsUrn))}/cts-api-xml/`;
}

function decodeXmlEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)));
}

export function scaifePassageExcerpt(xml, limit = 600) {
  const source = String(xml || '');
  const passage = source.match(/<(?:[A-Za-z0-9_-]+:)?passage\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?passage>/i)?.[1] || '';
  if (!passage) return null;
  const text = decodeXmlEntities(passage
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

export class ScaifeConnector {
  constructor({ offline = false } = {}) { this.offline = offline; }

  async getPassage(ctsUrn) {
    const urn = validatedUrn(ctsUrn);
    const verificationUrl = scaifeVerificationUrl(urn);
    const result = await safeFetchText(verificationUrl, { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1', offline: this.offline });
    return {
      urn,
      reader_url: scaifeReaderUrl(urn),
      verification_url: verificationUrl,
      excerpt: scaifePassageExcerpt(result.text),
      xml: result.text.slice(0, 50000),
      fetched_url: result.finalUrl,
      security: result.security,
    };
  }
}

import { stripMarkup } from '../security/untrusted.mjs';
import { safeFetchJson } from './http.mjs';

export class CommonsConnector {
  constructor({ offline = false } = {}) { this.offline = offline; }

  async getFile(filename) {
    const file = String(filename || '').trim().replace(/^File:/i, '');
    if (!file || file.length > 500) throw new Error('Invalid Commons filename');
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', `File:${file}`);
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url|extmetadata');
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    const result = await safeFetchJson(url.toString(), { offline: this.offline });
    const page = result.data?.query?.pages?.[0];
    const info = page?.imageinfo?.[0];
    if (!info) throw new Error(`Commons image not found: ${file}`);
    const meta = info.extmetadata || {};
    return {
      filename: page.title?.replace(/^File:/, '') || file,
      file_url: info.url || null,
      description_url: info.descriptionurl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
      artist: stripMarkup(meta.Artist?.value || ''),
      credit: stripMarkup(meta.Credit?.value || ''),
      license: stripMarkup(meta.LicenseShortName?.value || meta.UsageTerms?.value || ''),
      license_url: meta.LicenseUrl?.value || null,
      fetched_url: result.finalUrl,
      security: result.security,
    };
  }
}

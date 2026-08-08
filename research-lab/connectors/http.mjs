import { SOURCE_HOSTS, USER_AGENT } from '../config.mjs';
import { assessUntrustedText } from '../security/untrusted.mjs';

function assertAllowed(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !SOURCE_HOSTS.has(parsed.hostname)) {
    throw new Error(`Source URL blocked by research allowlist: ${parsed.origin}`);
  }
  return parsed;
}

export async function safeFetch(url, { accept = '*/*', timeoutMs = 15000, offline = false } = {}) {
  if (offline) throw new Error('Research network disabled by AWE_RESEARCH_OFFLINE');
  let current = assertAllowed(url);

  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: accept, 'User-Agent': USER_AGENT },
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Source redirect ${response.status} without Location header`);
      current = assertAllowed(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Source HTTP ${response.status} from ${current.hostname}`);

    const finalUrl = assertAllowed(response.url || current.toString());
    return { response, finalUrl: finalUrl.toString() };
  }
  throw new Error('Source redirect limit exceeded');
}

export async function safeFetchJson(url, options = {}) {
  const { response, finalUrl } = await safeFetch(url, { ...options, accept: 'application/json' });
  const raw = await response.text();
  const security = assessUntrustedText(raw);
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(`Expected JSON from ${new URL(finalUrl).hostname}`); }
  return { data, finalUrl, security };
}

export async function safeFetchText(url, options = {}) {
  const { response, finalUrl } = await safeFetch(url, options);
  const raw = await response.text();
  return { text: raw, finalUrl, security: assessUntrustedText(raw) };
}

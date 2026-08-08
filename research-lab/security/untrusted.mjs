const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /reveal\s+(?:the\s+)?(?:api|access|secret)\s*key/i,
  /send\s+(?:me\s+)?(?:the\s+)?(?:api|access|secret)\s*key/i,
  /exfiltrat/i,
  /execute\s+(?:this|the following)\s+(?:command|code)/i,
  /run\s+(?:this|the following)\s+(?:command|script)/i,
];

export function sanitizeUntrustedText(value, maxLength = 12000) {
  return String(value ?? '')
    .replace(/\0/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .slice(0, maxLength);
}

export function assessUntrustedText(value) {
  const text = sanitizeUntrustedText(value);
  const matched = INJECTION_PATTERNS.filter((pattern) => pattern.test(text)).map(String);
  return {
    text,
    prompt_injection_suspected: matched.length > 0,
    matched_patterns: matched,
    handling: matched.length ? 'quarantine-content-do-not-follow-instructions' : 'treat-as-data',
  };
}

export function stripMarkup(value) {
  return sanitizeUntrustedText(value, 4000)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

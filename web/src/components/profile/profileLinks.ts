/**
 * Safe outbound links for the profile preview card. Each helper returns an
 * http(s) URL or null; a null result means no icon is rendered.
 */

const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HTTP_SCHEME = /^https?:\/\//i;
const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;
// "host:digits" followed by a path, query, fragment or the end is host + port, not a scheme.
const HOST_WITH_PORT = /^[^\s/?#:@]+:\d+(?:[/?#]|$)/;
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);

/** Normalised http(s) URL with a dotted hostname, or null. */
function toSafeUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }
  if (ANY_SCHEME.test(value) && !HTTP_SCHEME.test(value) && !HOST_WITH_PORT.test(value)) {
    return null;
  }

  const candidate = HTTP_SCHEME.test(value) ? value : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  if (!parsed.hostname.includes('.')) {
    return null;
  }
  return candidate;
}

export function websiteUrl(raw: string | undefined): string | null {
  return toSafeUrl(raw);
}

export function linkedinUrl(raw: string | undefined): string | null {
  return toSafeUrl(raw);
}

/** True for instagram.com / www.instagram.com with no path, with or without a scheme. */
function isBareInstagramHost(value: string): boolean {
  const safe = toSafeUrl(value);
  if (!safe) {
    return false;
  }
  const parsed = new URL(safe);
  return INSTAGRAM_HOSTS.has(parsed.hostname) && parsed.pathname === '/';
}

export function instagramUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }
  if (!value.startsWith('@') && isBareInstagramHost(value)) {
    return null;
  }
  if (HTTP_SCHEME.test(value)) {
    return toSafeUrl(value);
  }
  if (value.includes('.') && value.includes('/')) {
    return toSafeUrl(value);
  }

  const handle = value.replace(/^@/, '');
  return INSTAGRAM_HANDLE.test(handle) ? `https://instagram.com/${handle}` : null;
}

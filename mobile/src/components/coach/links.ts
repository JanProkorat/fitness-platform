/** Safe outbound links for a coach profile: each helper returns an http(s) URL or null. */

const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HTTP_SCHEME = /^https?:\/\//i;
const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/** A normalised http(s) URL with a dotted hostname, or null. */
function toSafeUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (ANY_SCHEME.test(value) && !HTTP_SCHEME.test(value)) return null;

  const candidate = HTTP_SCHEME.test(value) ? value : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname.includes('.')) return null;
  return candidate;
}

export function websiteUrl(raw: string | undefined): string | null {
  return toSafeUrl(raw);
}

export function linkedinUrl(raw: string | undefined): string | null {
  return toSafeUrl(raw);
}

export function instagramUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (HTTP_SCHEME.test(value)) return toSafeUrl(value);
  if (value.includes('.') && value.includes('/')) return toSafeUrl(value);

  const handle = value.replace(/^@/, '');
  return INSTAGRAM_HANDLE.test(handle) ? `https://instagram.com/${handle}` : null;
}

/** What a link row shows under its name: the host without "www.", or the Instagram handle. */
export function linkLabel(url: string, kind: 'website' | 'instagram' | 'linkedin'): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, '');
    if (kind === 'instagram') {
      const handle = parsed.pathname.split('/').filter(Boolean)[0];
      return handle ? `@${handle}` : host;
    }
    const path = parsed.pathname.replace(/\/$/, '');
    return `${host}${path}`;
  } catch {
    return url;
  }
}

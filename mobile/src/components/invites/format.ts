import type { TFunction } from 'i18next';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "2 hours ago" style label, localised through the invites.time keys. */
export function relativeTime(t: TFunction, iso: string | undefined, now: number = Date.now()): string {
  const then = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(then)) return '';
  const elapsed = Math.max(0, now - then);
  if (elapsed < MINUTE_MS) return t('invites.time.justNow');
  if (elapsed < HOUR_MS) return t('invites.time.minutes', { count: Math.floor(elapsed / MINUTE_MS) });
  if (elapsed < DAY_MS) return t('invites.time.hours', { count: Math.floor(elapsed / HOUR_MS) });
  return t('invites.time.days', { count: Math.floor(elapsed / DAY_MS) });
}

/** "Expires in 7 days" label, or null when there is no usable expiry. */
export function expiryLabel(t: TFunction, iso: string | undefined, now: number = Date.now()): string | null {
  const at = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(at)) return null;
  const days = Math.ceil((at - now) / DAY_MS);
  return days <= 1 ? t('invites.expiresToday') : t('invites.expiresIn', { count: days });
}

/** Up to two initials from a full name. */
export function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export function firstName(name: string | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

export type CoachRoleKind = 'Trainer' | 'Nutritionist';

/** The roles in a joined display string such as "Trainer & Nutritionist". */
export function parseCoachRoles(coachRole: string | undefined): CoachRoleKind[] {
  const roles: CoachRoleKind[] = [];
  if (coachRole?.includes('Trainer')) roles.push('Trainer');
  if (coachRole?.includes('Nutritionist')) roles.push('Nutritionist');
  return roles;
}

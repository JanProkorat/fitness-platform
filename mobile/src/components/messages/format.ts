import type { TFunction } from 'i18next';

import { CooperationCardStatus, CooperationDirection, CooperationType } from '@/api/generated';
import type { ConversationCooperationDto } from '@/api/generated';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const ROLE_ORDER = ['Trainer', 'Nutritionist'] as const;

export type CoachRole = (typeof ROLE_ORDER)[number];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Whole calendar days between `iso` and `now`; zero for today. NaN when `iso` is unusable. */
function daysAgo(iso: string | undefined, now: number): number {
  const then = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(then)) return Number.NaN;
  return Math.round((startOfDay(new Date(now)) - startOfDay(new Date(then))) / DAY_MS);
}

const timeOfDay = (iso: string, locale: string) =>
  new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

/** Role names in display order, Trainer first; unknown roles are dropped. */
export function sortedRoles(roles: string[] | undefined): CoachRole[] {
  return ROLE_ORDER.filter((role) => roles?.includes(role));
}

/** "Trainer · Nutritionist" through the messages.roles keys; empty when the participant has no coach role. */
export function roleLine(t: TFunction, roles: string[] | undefined): string {
  return sortedRoles(roles)
    .map((role) => t(`messages.roles.${role}`))
    .join(t('messages.roleJoiner'));
}

/** Time for a list row: clock time today, "Yesterday", weekday within a week, otherwise a short date. */
export function listTime(t: TFunction, locale: string, iso: string | undefined, now: number = Date.now()): string {
  const days = daysAgo(iso, now);
  if (Number.isNaN(days) || !iso) return '';
  if (days <= 0) return timeOfDay(iso, locale);
  if (days === 1) return t('messages.yesterday');
  if (days < WEEK_DAYS) return new Date(iso).toLocaleDateString(locale, { weekday: 'short' });
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** Separator above the first message of a day: "Today 11:20", "Yesterday 09:05" or "Tuesday 18:05". */
export function daySeparator(t: TFunction, locale: string, iso: string | undefined, now: number = Date.now()): string {
  const days = daysAgo(iso, now);
  if (Number.isNaN(days) || !iso) return '';
  const time = timeOfDay(iso, locale);
  if (days <= 0) return t('chat.dayToday', { time });
  if (days === 1) return t('chat.dayYesterday', { time });
  const date =
    days < WEEK_DAYS
      ? new Date(iso).toLocaleDateString(locale, { weekday: 'long' })
      : new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return `${date} ${time}`;
}

/** "21 Oct" style date for the tail of a settled event card. */
export function shortDate(locale: string, iso: string | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return '';
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** "Read only · ended June 2026", or "Read only" alone when the end date is unknown. */
export function readOnlyLine(t: TFunction, locale: string, endedAt: string | undefined): string {
  if (!endedAt || Number.isNaN(Date.parse(endedAt))) return t('messages.readOnly');
  const date = new Date(endedAt).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return t('messages.readOnlyEnded', { date });
}

/** Label for the list row: invite waiting on the client, or a request the client sent; nothing otherwise. */
export function cooperationLabel(t: TFunction, cooperation: ConversationCooperationDto | undefined): string | null {
  if (cooperation?.status !== CooperationCardStatus.Pending) return null;
  if (cooperation.type === CooperationType.Invite && cooperation.direction === CooperationDirection.Received) {
    return t('messages.labels.invite');
  }
  if (cooperation.type === CooperationType.Request && cooperation.direction === CooperationDirection.Sent) {
    return t('messages.labels.requestSent');
  }
  return null;
}

/** "expires in 7 days" for a card, or null when the expiry is unknown. */
export function cardExpiry(t: TFunction, iso: string | undefined, now: number = Date.now()): string | null {
  const at = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(at)) return null;
  const days = Math.ceil((at - now) / DAY_MS);
  return days <= 1 ? t('chat.card.expiresToday') : t('chat.card.expiresIn', { count: days });
}

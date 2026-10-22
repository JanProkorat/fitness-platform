import type { TFunction } from 'i18next';

import { PrimaryGoal } from '@/api/generated';

const MINUS = '−';
const EM_DASH = '—';

/** Placeholder shown wherever a value is missing. */
export const EMPTY_VALUE = EM_DASH;

const GOALS = new Set<string>(Object.values(PrimaryGoal));

function formatKg(t: TFunction, language: string, kg: number): string {
  const value = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(kg);
  return t('profile.units.kg', { value });
}

/** "72.4 kg", or a dash when no weight was ever recorded. */
export function weightLabel(t: TFunction, language: string, kg: number | undefined): string {
  return kg === undefined || !Number.isFinite(kg) ? EMPTY_VALUE : formatKg(t, language, kg);
}

/** Signed change such as "−3.7 kg" with a true minus sign; a dash when there is no weight. */
export function weightChangeLabel(t: TFunction, language: string, kg: number | undefined): string {
  if (kg === undefined || !Number.isFinite(kg)) return EMPTY_VALUE;
  const rounded = Math.round(kg * 10) / 10;
  if (rounded === 0) return formatKg(t, language, 0);
  const sign = rounded < 0 ? MINUS : '+';
  return `${sign}${formatKg(t, language, Math.abs(rounded))}`;
}

/** Whole count with locale grouping; zero stays "0". */
export function countLabel(language: string, count: number | undefined): string {
  return new Intl.NumberFormat(language).format(count ?? 0);
}

/** "March 2026" in the active language, or null when the date is missing or invalid. */
export function memberSinceLabel(language: string, iso: string | undefined): string | null {
  const time = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(new Date(time));
}

/** "Lose fat · since March 2026"; either half is dropped when its data is missing. */
export function subtitleLabel(
  t: TFunction,
  language: string,
  goal: string | undefined,
  memberSince: string | undefined,
): string {
  const goalLabel = goal && GOALS.has(goal) ? t(`profile.goals.${goal}`) : null;
  const since = memberSinceLabel(language, memberSince);
  return [goalLabel, since ? t('profile.since', { date: since }) : null].filter(Boolean).join(' · ');
}

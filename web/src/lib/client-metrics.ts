import type { MeasurementDto } from '@/api/generated';
import type { RawTrainingPlanDetail, RawTrainingSession } from '@/api/training-plan-types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Age in whole years, computed from a birthdate that hasn't necessarily occurred yet this year. */
export function calculateAge(dateOfBirth: string): number | undefined {
  // Read the calendar date straight from the string so no UTC/local conversion can shift the day.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  if (!match) {
    return undefined;
  }
  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const hadBirthdayThisYear =
    today.getMonth() + 1 > birthMonth || (today.getMonth() + 1 === birthMonth && today.getDate() >= birthDay);
  if (!hadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}

/**
 * Nearest measurement at least 7 days older than the most recent one,
 * subtracted from it — not simply "the second most recent". Returns
 * undefined (never 0) when fewer than two measurements exist, or none is
 * old enough to compare against.
 */
export function computeWeeklyWeightDelta(items: MeasurementDto[]): number | undefined {
  const withWeight = items
    .filter((m): m is MeasurementDto & { weightKg: number; measuredAt: string } => m.weightKg != null && m.measuredAt != null)
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());

  if (withWeight.length < 2) {
    return undefined;
  }

  const latest = withWeight[0];
  const latestTime = new Date(latest.measuredAt).getTime();
  const sevenDaysMs = 7 * MS_PER_DAY;

  let closest: (typeof withWeight)[number] | undefined;
  let closestOverflow = Number.POSITIVE_INFINITY;
  for (const measurement of withWeight.slice(1)) {
    const age = latestTime - new Date(measurement.measuredAt).getTime();
    if (age < sevenDaysMs) {
      continue;
    }
    const overflow = age - sevenDaysMs;
    if (overflow < closestOverflow) {
      closestOverflow = overflow;
      closest = measurement;
    }
  }

  if (!closest) {
    return undefined;
  }

  return Number((latest.weightKg - closest.weightKg).toFixed(1));
}

export function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY));
}

export interface ResolvedSession {
  session: RawTrainingSession;
  /** 1 = Monday ... 7 = Sunday, as stored on the plan's day. */
  dayOfWeek: number;
}

/**
 * Resolves the "latest workout" session: there is no single "most recent
 * session" concept on the wire, so this mirrors how a coach reads the plan
 * — the session closest to "now", computed from the plan's Monday-anchored
 * `startDate` plus each day's (weekNumber, dayOfWeek) offset. Prefers the
 * most recently held session; falls back to the soonest upcoming one for a
 * plan that hasn't started yet.
 */
export function resolveMostRecentSessionWithDay(plan: RawTrainingPlanDetail): ResolvedSession | undefined {
  if (!plan.startDate) {
    return undefined;
  }
  const planStart = new Date(plan.startDate);
  const now = Date.now();

  let mostRecentPast: (ResolvedSession & { time: number }) | undefined;
  let soonestFuture: (ResolvedSession & { time: number }) | undefined;

  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.sessions.length === 0) {
        continue;
      }
      const sessionDate = new Date(planStart);
      sessionDate.setDate(sessionDate.getDate() + (week.weekNumber - 1) * 7 + (day.dayOfWeek - 1));
      const time = sessionDate.getTime();

      for (const session of day.sessions) {
        if (time <= now) {
          if (!mostRecentPast || time > mostRecentPast.time) {
            mostRecentPast = { session, dayOfWeek: day.dayOfWeek, time };
          }
        } else if (!soonestFuture || time < soonestFuture.time) {
          soonestFuture = { session, dayOfWeek: day.dayOfWeek, time };
        }
      }
    }
  }

  const resolved = mostRecentPast ?? soonestFuture;
  return resolved ? { session: resolved.session, dayOfWeek: resolved.dayOfWeek } : undefined;
}

export function resolveMostRecentSession(plan: RawTrainingPlanDetail): RawTrainingSession | undefined {
  return resolveMostRecentSessionWithDay(plan)?.session;
}

export interface MacroShares {
  proteinPct: number;
  carbPct: number;
  fatPct: number;
}

/**
 * Macro shares derived from grams over the plan's daily kcal target — standard
 * 4 kcal/g (protein, carbs) / 9 kcal/g (fat). Independent rounding can land
 * the three shares up to 1 point off 100. Undefined when any input is missing.
 */
export function computeMacroShares(
  dailyKcal: number | null | undefined,
  proteinGrams: number | null | undefined,
  carbsGrams: number | null | undefined,
  fatGrams: number | null | undefined,
): MacroShares | undefined {
  if (dailyKcal == null || dailyKcal <= 0 || proteinGrams == null || carbsGrams == null || fatGrams == null) {
    return undefined;
  }
  return {
    proteinPct: Math.round(((proteinGrams * 4) / dailyKcal) * 100),
    carbPct: Math.round(((carbsGrams * 4) / dailyKcal) * 100),
    fatPct: Math.round(((fatGrams * 9) / dailyKcal) * 100),
  };
}

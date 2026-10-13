import type { MeasurementDto } from '@/api/generated';
import { currentWeekNumber, parseCalendarDate } from '@/components/client-detail/nutrition/nutritionPlanView';

/** A target weight closer than this to the first weigh-in counts as "keep the weight". */
export const GOAL_NEUTRAL_BAND_KG = 0.5;
/** Largest drift from the first weigh-in that still counts as holding the weight. */
export const MAINTAIN_TOLERANCE_KG = 1.0;
/** Page size of the extra query that reaches the client's oldest measurements. */
export const OLDEST_MEASUREMENTS_PAGE_SIZE = 100;

type WeighedMeasurement = MeasurementDto & { weightKg: number; measuredAt: string };

/** Measurements that carry a weight, newest first. */
export function weighedMeasurements(items: MeasurementDto[] | undefined): WeighedMeasurement[] {
  return (items ?? [])
    .filter((m): m is WeighedMeasurement => m.weightKg != null && m.measuredAt != null)
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
}

/** One-decimal rounding that never yields -0. */
export function roundToTenth(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

/** 1-based page that holds the oldest measurements, or undefined when page 1 already holds them all. */
export function oldestMeasurementsPage(totalCount: number | undefined, firstPageSize: number): number | undefined {
  if (totalCount == null || totalCount <= firstPageSize) {
    return undefined;
  }
  return Math.ceil(totalCount / OLDEST_MEASUREMENTS_PAGE_SIZE);
}

export interface WeightSummary {
  latestKg: number;
  /** Latest minus first weigh-in; undefined with fewer than two weighed measurements. */
  changeKg?: number;
  /** First weigh-in, used to judge the direction against the goal. */
  baselineKg?: number;
}

/**
 * Latest weight and its change since the client's first weigh-in. `firstPage`
 * is the newest page; `oldestPage` the page holding the oldest measurements
 * (absent when the first page already holds everything).
 */
export function summarizeWeight(
  firstPage: MeasurementDto[] | undefined,
  oldestPage: MeasurementDto[] | undefined,
): WeightSummary | undefined {
  const recent = weighedMeasurements(firstPage);
  const latest = recent[0];
  if (!latest) {
    return undefined;
  }
  const oldestWeighed = weighedMeasurements(oldestPage);
  const baseline = oldestWeighed[oldestWeighed.length - 1] ?? recent[recent.length - 1];
  const isSameMeasurement =
    baseline.measurementId != null && latest.measurementId != null
      ? baseline.measurementId === latest.measurementId
      : baseline.measuredAt === latest.measuredAt;
  if (isSameMeasurement) {
    return { latestKg: latest.weightKg };
  }
  return {
    latestKg: latest.weightKg,
    changeKg: roundToTenth(latest.weightKg - baseline.weightKg),
    baselineKg: baseline.weightKg,
  };
}

/**
 * Whether a weight change moves toward the client's goal. A target weight
 * decides when it is meaningfully away from the first weigh-in; otherwise the
 * primary goal does. Goals without a weight direction are never green.
 */
export function isMovingTowardGoal(
  baselineKg: number,
  changeKg: number,
  targetWeightKg: number | undefined,
  primaryGoal: string | undefined,
): boolean {
  if (targetWeightKg != null) {
    const gap = targetWeightKg - baselineKg;
    if (Math.abs(gap) > GOAL_NEUTRAL_BAND_KG) {
      return changeKg !== 0 && Math.sign(changeKg) === Math.sign(gap);
    }
    return Math.abs(changeKg) <= MAINTAIN_TOLERANCE_KG;
  }
  switch (primaryGoal) {
    case 'LoseFat':
      return changeKg < 0;
    case 'GainMuscle':
      return changeKg > 0;
    case 'Maintain':
      return Math.abs(changeKg) <= MAINTAIN_TOLERANCE_KG;
    default:
      return false;
  }
}

/**
 * Week of an Active plan that today falls in, clamped to 1..totalWeeks;
 * undefined when the plan has no start date or no known length.
 */
export function planWeekOf(
  periodStart: string | undefined,
  totalWeeks: number | undefined,
  today: Date,
): { week: number; total: number } | undefined {
  const start = parseCalendarDate(periodStart);
  if (!start || !totalWeeks || totalWeeks < 1) {
    return undefined;
  }
  const raw = currentWeekNumber(start, today) ?? 1;
  return { week: Math.min(Math.max(raw, 1), totalWeeks), total: totalWeeks };
}

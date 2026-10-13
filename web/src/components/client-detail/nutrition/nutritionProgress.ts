import type { ClientPlanItem, MeasurementDto } from '@/api/generated';
import {
  addDays,
  diffDays,
  nutritionPlans,
  parseCalendarDate,
  todayCalendarDate,
} from '@/components/client-detail/nutrition/nutritionPlanView';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const MIN_SPAN_DAYS = 7;
const MAX_ETA_DAYS = 365;
const REACHED_TOLERANCE_KG = 0.5;

/** Number of Monday-Sunday weeks shown, the last one being the current week. */
export const PROGRESS_WEEK_COUNT = 8;

export interface ProgressWeek {
  /** 1-based position, 1 = oldest week. */
  number: number;
  /** Monday of the week, as a calendar date at UTC midnight. */
  start: Date;
  /** Latest weigh-in of the week; undefined when the week has none. */
  weightKg?: number;
  planId?: string;
  /** Planned kcal a day of the week's plan; undefined draws no bar. */
  plannedKcal?: number;
}

export type TargetStatus =
  | { kind: 'noTarget' }
  | { kind: 'reached' }
  | { kind: 'onTrack'; eta: Date }
  | { kind: 'farOff' }
  | { kind: 'offTrack' };

export interface ProgressModel {
  weeks: ProgressWeek[];
  /** Last minus first weight of the window, one decimal; undefined when there are too few weigh-ins. */
  deltaKg?: number;
  /** Undefined together with `deltaKg`. */
  status?: TargetStatus;
  /** Indexes (>= 1) of weeks that start a different plan than the week before. */
  planChanges: number[];
  hasWeights: boolean;
  hasBars: boolean;
}

interface WeighIn {
  time: number;
  day: Date;
  weightKg: number;
}

/** Local calendar day of an instant, expressed as UTC midnight. */
function localCalendarDay(iso: string): Date | undefined {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function mondayOf(day: Date): Date {
  const daysSinceMonday = (day.getUTCDay() + 6) % DAYS_PER_WEEK;
  return addDays(day, -daysSinceMonday);
}

function selectWeighIns(measurements: MeasurementDto[]): WeighIn[] {
  const weighIns: WeighIn[] = [];
  for (const measurement of measurements) {
    if (measurement.weightKg == null || !measurement.measuredAt) {
      continue;
    }
    const day = localCalendarDay(measurement.measuredAt);
    if (day) {
      weighIns.push({ time: new Date(measurement.measuredAt).getTime(), day, weightKg: measurement.weightKg });
    }
  }
  return weighIns.sort((a, b) => a.time - b.time);
}

/** The nutrition plan covering a week; ties go to the latest start. Drafts and unscheduled plans are ignored. */
function planForWeek(plans: ClientPlanItem[], weekStart: Date, today: Date): ClientPlanItem | undefined {
  const weekEnd = addDays(weekStart, DAYS_PER_WEEK - 1);
  let best: { plan: ClientPlanItem; start: Date } | undefined;
  for (const plan of plans) {
    if (plan.status !== 'Active' && plan.status !== 'Completed' && plan.status !== 'Archived') {
      continue;
    }
    const start = parseCalendarDate(plan.periodStart);
    if (!start) {
      continue;
    }
    const end = parseCalendarDate(plan.periodEnd) ?? today;
    if (start.getTime() <= weekEnd.getTime() && end.getTime() >= weekStart.getTime()) {
      if (!best || start.getTime() > best.start.getTime()) {
        best = { plan, start };
      }
    }
  }
  return best?.plan;
}

function resolveStatus(
  first: WeighIn,
  last: WeighIn,
  targetKg: number | null | undefined,
): TargetStatus {
  if (targetKg == null) {
    return { kind: 'noTarget' };
  }
  const remaining = targetKg - last.weightKg;
  if (Math.abs(remaining) <= REACHED_TOLERANCE_KG) {
    return { kind: 'reached' };
  }
  const spanDays = (last.time - first.time) / MS_PER_DAY;
  const rate = (last.weightKg - first.weightKg) / spanDays;
  if (rate === 0 || Math.sign(rate) !== Math.sign(remaining)) {
    return { kind: 'offTrack' };
  }
  const etaDays = remaining / rate;
  if (etaDays > MAX_ETA_DAYS) {
    return { kind: 'farOff' };
  }
  return { kind: 'onTrack', eta: new Date(last.time + etaDays * MS_PER_DAY) };
}

/** Builds the eight-week "Is it working?" model from the plans list and the weigh-ins. */
export function buildProgress(
  plans: ClientPlanItem[] | undefined,
  measurements: MeasurementDto[],
  targetKg: number | null | undefined,
  now: Date = new Date(),
): ProgressModel {
  const today = todayCalendarDate(now);
  const currentMonday = mondayOf(today);
  const nutrition = nutritionPlans(plans);
  const weighIns = selectWeighIns(measurements);

  const weeks: ProgressWeek[] = [];
  for (let index = 0; index < PROGRESS_WEEK_COUNT; index += 1) {
    const start = addDays(currentMonday, -(PROGRESS_WEEK_COUNT - 1 - index) * DAYS_PER_WEEK);
    const weekWeighIns = weighIns.filter(
      (entry) => entry.day.getTime() >= start.getTime() && diffDays(entry.day, start) < DAYS_PER_WEEK,
    );
    const plan = planForWeek(nutrition, start, today);
    weeks.push({
      number: index + 1,
      start,
      weightKg: weekWeighIns.length > 0 ? weekWeighIns[weekWeighIns.length - 1].weightKg : undefined,
      planId: plan?.planId,
      plannedKcal: plan?.plannedDailyKcal ?? undefined,
    });
  }

  const planChanges: number[] = [];
  for (let index = 1; index < weeks.length; index += 1) {
    if (weeks[index].planId && weeks[index].planId !== weeks[index - 1].planId) {
      planChanges.push(index);
    }
  }

  const windowStart = weeks[0].start;
  const windowWeighIns = weighIns.filter((entry) => entry.day.getTime() >= windowStart.getTime());
  const first = windowWeighIns[0];
  const last = windowWeighIns[windowWeighIns.length - 1];
  let deltaKg: number | undefined;
  let status: TargetStatus | undefined;
  if (first && last && windowWeighIns.length >= 2 && last.time - first.time >= MIN_SPAN_DAYS * MS_PER_DAY) {
    deltaKg = Number((last.weightKg - first.weightKg).toFixed(1));
    status = resolveStatus(first, last, targetKg);
  }

  return {
    weeks,
    deltaKg,
    status,
    planChanges,
    hasWeights: weeks.some((week) => week.weightKg !== undefined),
    hasBars: weeks.some((week) => week.plannedKcal !== undefined),
  };
}

import { useMemo } from 'react';
import type { ClientTimelineItem, PersonalRecordPayload } from '@/api/timeline';

export type FilterType = 'all' | 'pr' | 'workout' | 'measurement' | 'meal';

/** A single event row inside a day card */
export interface DayEvent {
  id: string;
  type: ClientTimelineItem['type'];
  title: string;
  description?: string;
  icon?: string;
  /** Populated only for personal_record items */
  personalRecord?: PersonalRecordPayload | null;
}

/** Items grouped by calendar date string (YYYY-MM-DD) */
export interface DayGroup {
  dateKey: string;         // YYYY-MM-DD used as stable key
  dateLabel: string;       // localised display label, e.g. "15. 5. 2026"
  prCount: number;
  workoutCount: number;
  measurementCount: number;
  mealCount: number;
  exerciseCount: number;   // across all workouts in this day
  events: DayEvent[];
}

export interface ThisMonthAggregates {
  prTotal: number;
  workoutTotal: number;
  measurementTotal: number;
  /** unique meal_day dates in current calendar month */
  completedDays: number;
  /** total days elapsed in current calendar month (up to today) */
  totalDaysInMonth: number;
}

export interface TopPrRecord {
  exerciseName: string;
  weightKg: number;
  reps: number;
  date: string;
}

export interface ThisWeekAggregates {
  workouts: number;
  prs: number;
  /** 0–100, or null if no data */
  compliancePercent: number | null;
}

export interface RecentActivityAggregates {
  dayGroups: DayGroup[];
  thisMonth: ThisMonthAggregates;
  topPr: TopPrRecord | null;
  thisWeek: ThisWeekAggregates;
}

function toDateKey(isoString: string): string {
  return isoString.substring(0, 10); // "YYYY-MM-DD"
}

function toDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${day}. ${month}. ${year}`;
}

function startOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon …
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  const mon = new Date(now);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(now.getDate() + diff);
  return mon;
}

export function useRecentActivityAggregates(
  items: ClientTimelineItem[],
): RecentActivityAggregates {
  return useMemo<RecentActivityAggregates>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const weekStart = startOfCurrentWeek();

    // --- group items by day ---
    const groupMap = new Map<string, DayGroup>();

    for (const item of items) {
      const dateKey = toDateKey(item.occurredAt);

      if (!groupMap.has(dateKey)) {
        groupMap.set(dateKey, {
          dateKey,
          dateLabel: toDateLabel(dateKey),
          prCount: 0,
          workoutCount: 0,
          measurementCount: 0,
          mealCount: 0,
          exerciseCount: 0,
          events: [],
        });
      }

      const group = groupMap.get(dateKey)!;

      // Accumulate counts
      if (item.type === 'personal_record') group.prCount++;
      else if (item.type === 'workout') group.workoutCount++;
      else if (item.type === 'measurement') group.measurementCount++;
      else if (item.type === 'meal_day') group.mealCount++;

      group.events.push({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description ?? undefined,
        icon: item.icon ?? undefined,
        personalRecord: item.personalRecord,
      });
    }

    // Sort day groups newest-first
    const dayGroups = Array.from(groupMap.values()).sort(
      (a, b) => b.dateKey.localeCompare(a.dateKey),
    );

    // --- This Month ---
    const monthItems = items.filter((it) => {
      const d = new Date(it.occurredAt);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const monthMealDays = new Set<string>();
    let monthPr = 0;
    let monthWorkout = 0;
    let monthMeasurement = 0;

    for (const it of monthItems) {
      if (it.type === 'personal_record') monthPr++;
      else if (it.type === 'workout') monthWorkout++;
      else if (it.type === 'measurement') monthMeasurement++;
      else if (it.type === 'meal_day') monthMealDays.add(toDateKey(it.occurredAt));
    }

    // How many days have elapsed so far this month (1 → today's day number)
    const totalDaysInMonth = now.getDate();

    // --- Top PR (this month, highest weightKg) ---
    let topPr: TopPrRecord | null = null;
    for (const it of monthItems) {
      if (it.type === 'personal_record' && it.personalRecord) {
        const pr = it.personalRecord;
        if (
          topPr === null ||
          pr.weightKg > topPr.weightKg ||
          (pr.weightKg === topPr.weightKg && pr.reps > topPr.reps)
        ) {
          topPr = {
            exerciseName: pr.exerciseName,
            weightKg: pr.weightKg,
            reps: pr.reps,
            date: toDateLabel(toDateKey(it.occurredAt)),
          };
        }
      }
    }

    // --- This Week ---
    const weekItems = items.filter((it) => {
      const d = new Date(it.occurredAt);
      return d >= weekStart;
    });

    let weekWorkouts = 0;
    let weekPrs = 0;
    const weekMealDays = new Set<string>();

    for (const it of weekItems) {
      if (it.type === 'workout') weekWorkouts++;
      else if (it.type === 'personal_record') weekPrs++;
      else if (it.type === 'meal_day') weekMealDays.add(toDateKey(it.occurredAt));
    }

    // Days elapsed in current week (Mon through today, inclusive)
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysElapsedInWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // Mon=1…Sun=7

    const weekCompliancePct =
      daysElapsedInWeek > 0
        ? Math.round((weekMealDays.size / daysElapsedInWeek) * 100)
        : null;

    return {
      dayGroups,
      thisMonth: {
        prTotal: monthPr,
        workoutTotal: monthWorkout,
        measurementTotal: monthMeasurement,
        completedDays: monthMealDays.size,
        totalDaysInMonth,
      },
      topPr,
      thisWeek: {
        workouts: weekWorkouts,
        prs: weekPrs,
        compliancePercent: weekCompliancePct,
      },
    };
  }, [items]);
}

/**
 * Returns true if a day group contains at least one event matching the filter.
 */
export function dayGroupMatchesFilter(
  group: DayGroup,
  filter: FilterType,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'pr') return group.prCount > 0;
  if (filter === 'workout') return group.workoutCount > 0;
  if (filter === 'measurement') return group.measurementCount > 0;
  if (filter === 'meal') return group.mealCount > 0;
  return true;
}

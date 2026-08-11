import type { ClientDashboardItem } from '@/api/dashboard';
// Module-scope helper — no React hook available here. Use the i18n singleton
// directly, mirroring lib/api-errors.ts.
import i18n from '@/i18n';

export function complianceColor(c: number): string {
  if (c >= 80) return 'var(--green)';
  if (c >= 60) return 'var(--orange)';
  return 'var(--red)';
}

export function initials(first?: string, last?: string): string {
  return `${(first ?? '')[0] ?? ''}${(last ?? '')[0] ?? ''}`.toUpperCase();
}

/**
 * Goal label → tag variant mapping. This maps free-text goal strings to a
 * COLOR variant (not a translated string) so it needs no i18n keys — just
 * phrases in every locale the trainer might type/see the goal in.
 */
const GOAL_TAGS: Record<string, EnrichedClient['goalTag']> = {
  hubnutí: 'blue',
  'weight loss': 'blue',
  abnehmen: 'blue',
  gewichtsabnahme: 'blue',
  nabírání: 'purple',
  'weight gain': 'purple',
  'muscle gain': 'purple',
  zunehmen: 'purple',
  muskelaufbau: 'purple',
  zdraví: 'green',
  health: 'green',
  gesundheit: 'green',
  výkonnost: 'orange',
  performance: 'orange',
  leistung: 'orange',
  síla: 'gray',
  strength: 'gray',
  kraft: 'gray',
};

function goalToTag(goal: string | null): EnrichedClient['goalTag'] {
  if (!goal) return 'gray';
  const key = goal.toLowerCase().trim();
  return GOAL_TAGS[key] ?? 'gray';
}

/** Formats last activity timestamp as a relative label + color. */
function formatLastActivity(lastActivityAt: string | null): { text: string; color: string } {
  if (!lastActivityAt) return { text: '—', color: 'var(--text3)' };

  const now = new Date();
  const activity = new Date(lastActivityAt);
  const diffMs = now.getTime() - activity.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: i18n.t('dashboard.activityToday'), color: 'var(--green)' };
  if (diffDays === 1) return { text: i18n.t('dashboard.activityYesterday'), color: 'var(--green)' };
  if (diffDays <= 3) {
    return {
      text: i18n.t('dashboard.activityDaysAgo', { count: diffDays }),
      color: 'var(--text3)',
    };
  }
  return {
    text: i18n.t('dashboard.activityDaysAgo', { count: diffDays }),
    color: 'var(--red)',
  };
}

/**
 * A metric the API may withhold. `null` means "your link does not grant this domain", which is a
 * different thing from zero — the API deliberately sends null rather than 0 so the UI can say
 * "not visible" instead of asserting the client ate nothing or trained not at all.
 */
type WithheldableNumber = number | null;

export interface EnrichedClient extends ClientDashboardItem {
  goalTag: 'blue' | 'purple' | 'green' | 'orange' | 'gray';
  compliance: number;
  streak: number;
  kcal: WithheldableNumber;
  todayKcalRounded: WithheldableNumber;
  kcalGoal: WithheldableNumber;
  trains: WithheldableNumber;
  trainsGoal: WithheldableNumber;
  lastActivity: string;
  lastActivityColor: string;
}

/** Rounds a withheld-able metric without turning null into 0 — `Math.round(null)` is 0. */
function roundOrWithhold(value: number | null | undefined): WithheldableNumber {
  return value == null ? null : Math.round(value);
}

/** Shown in place of a metric the caller's link does not grant. */
export const WITHHELD_PLACEHOLDER = '—';

/**
 * Formats an "actual / goal" metric pair, collapsing to the withheld placeholder when either half
 * is unavailable. Never renders a withheld value as 0 — that would read as real data.
 */
export function formatMetricPair(actual: WithheldableNumber, goal: WithheldableNumber): string {
  if (actual == null || goal == null) return WITHHELD_PLACEHOLDER;
  return `${actual}/${goal}`;
}

/**
 * The actual-to-goal ratio, or null when either half is withheld or the goal is zero. Callers
 * sorting on this should place null consistently rather than treating it as 0.
 */
export function metricRatio(actual: WithheldableNumber, goal: WithheldableNumber): number | null {
  if (actual == null || goal == null || goal <= 0) return null;
  return actual / goal;
}

export function enrichClient(c: ClientDashboardItem): EnrichedClient {
  const activity = formatLastActivity(c.lastActivityAt);

  return {
    ...c,
    goalTag: goalToTag(c.goal),
    compliance: Math.round(c.compliancePercent),
    streak: c.currentStreak,
    kcal: roundOrWithhold(c.avgDailyKcal),
    todayKcalRounded: roundOrWithhold(c.todayKcal),
    kcalGoal: roundOrWithhold(c.kcalGoal),
    trains: c.workoutsCompleted,
    trainsGoal: c.workoutsPlanned,
    lastActivity: activity.text,
    lastActivityColor: activity.color,
  };
}

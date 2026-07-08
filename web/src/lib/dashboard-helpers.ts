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

export interface EnrichedClient extends ClientDashboardItem {
  goalTag: 'blue' | 'purple' | 'green' | 'orange' | 'gray';
  compliance: number;
  streak: number;
  kcal: number;
  todayKcalRounded: number;
  kcalGoal: number;
  trains: number;
  trainsGoal: number;
  lastActivity: string;
  lastActivityColor: string;
}

export function enrichClient(c: ClientDashboardItem): EnrichedClient {
  const activity = formatLastActivity(c.lastActivityAt);

  return {
    ...c,
    goalTag: goalToTag(c.goal),
    compliance: Math.round(c.compliancePercent),
    streak: c.currentStreak,
    kcal: Math.round(c.avgDailyKcal),
    todayKcalRounded: Math.round(c.todayKcal),
    kcalGoal: Math.round(c.kcalGoal ?? 0),
    trains: c.workoutsCompleted,
    trainsGoal: c.workoutsPlanned,
    lastActivity: activity.text,
    lastActivityColor: activity.color,
  };
}

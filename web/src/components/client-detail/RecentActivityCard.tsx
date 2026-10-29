import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { CalendarDays, ClipboardList, Dumbbell, History, Link2, TrendingUp, Trophy, Utensils, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientTimeline } from '@/hooks/useClientTimeline';
import { useClientOfflineSyncConflicts } from '@/hooks/useClientOfflineSyncConflicts';
import { formatRelativeTime, type ClientOverviewRole } from '@/lib/client-metrics';
import type { ClientTimelineItem } from '@/api/timeline';
import type { OfflineSyncConflictDto } from '@/api/generated';

interface Props {
  /** Route client id (PublicId), as the timeline endpoint expects. */
  clientId: string;
  /** Discipline(s) the viewer may see (effective flags); items of the other discipline are dropped. */
  role: ClientOverviewRole;
}

const ACTIVITY_LIMIT = 5;
const TRAINING_ONLY_TYPES = new Set(['personal_record', 'workout', 'training_plan_published']);
const NUTRITION_ONLY_TYPES = new Set(['meal_day', 'nutrition_plan_published']);

type Tone = 'training' | 'nutrition' | 'neutral';

interface TypeStyle {
  labelKey: string;
  Icon: LucideIcon;
  tone: Tone;
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  personal_record: { labelKey: 'personal_record', Icon: Trophy, tone: 'training' },
  workout: { labelKey: 'workout', Icon: Dumbbell, tone: 'training' },
  meal_day: { labelKey: 'meal_day', Icon: Utensils, tone: 'nutrition' },
  measurement: { labelKey: 'measurement', Icon: TrendingUp, tone: 'neutral' },
  questionnaire: { labelKey: 'questionnaire', Icon: ClipboardList, tone: 'neutral' },
  nutrition_plan_published: { labelKey: 'nutrition_plan_published', Icon: CalendarDays, tone: 'nutrition' },
  training_plan_published: { labelKey: 'training_plan_published', Icon: CalendarDays, tone: 'training' },
  linked: { labelKey: 'linked', Icon: Link2, tone: 'neutral' },
};

const FALLBACK_STYLE: TypeStyle = { labelKey: 'unknown', Icon: CalendarDays, tone: 'neutral' };

const TONE_CLASS: Record<Tone, string> = {
  training: 'bg-training-soft text-training-ink',
  nutrition: 'bg-nutrition-soft text-nutrition-ink',
  neutral: 'border border-border bg-card text-ink-2',
};

/** Detail text built from the structured payload only; the server's Czech title/description are never rendered. */
function activityDetail(item: ClientTimelineItem, t: TFunction, formatNumber: (value: number) => string): string | undefined {
  switch (item.type) {
    case 'personal_record': {
      const record = item.personalRecord;
      return record
        ? t('clientDetail.overview.activity.detail.personalRecord', {
            exercise: record.exerciseName,
            kg: formatNumber(record.weightKg),
            reps: record.reps,
          })
        : undefined;
    }
    case 'workout': {
      const workout = item.workout;
      if (!workout) {
        return undefined;
      }
      return workout.sessionName
        ? workout.sessionName
        : t('clientDetail.overview.workout.exercises', { count: workout.exerciseCount });
    }
    case 'meal_day': {
      const mealDay = item.mealDay;
      if (!mealDay) {
        return undefined;
      }
      return mealDay.mealsPlanned != null
        ? t('clientDetail.overview.activity.detail.mealsOfPlanned', {
            logged: mealDay.mealsLogged,
            planned: mealDay.mealsPlanned,
          })
        : t('clientDetail.overview.activity.detail.mealsLogged', { count: mealDay.mealsLogged });
    }
    case 'measurement': {
      const measurement = item.measurement;
      const parts = [
        measurement?.weightKg != null
          ? t('clientDetail.overview.activity.detail.weight', { kg: formatNumber(measurement.weightKg) })
          : undefined,
        measurement?.bodyFatPercentage != null
          ? t('clientDetail.overview.activity.detail.bodyFat', { value: formatNumber(measurement.bodyFatPercentage) })
          : undefined,
      ].filter((part): part is string => Boolean(part));
      return parts.length > 0 ? parts.join(', ') : undefined;
    }
    case 'questionnaire':
      return item.questionnaire?.questionnaireTitle || undefined;
    case 'nutrition_plan_published':
    case 'training_plan_published': {
      const published = item.planPublished;
      if (!published) {
        return undefined;
      }
      return published.planName
        ? t('clientDetail.overview.activity.detail.planWeek', { name: published.planName, week: published.weekNumber })
        : t('clientDetail.overview.activity.detail.weekOnly', { week: published.weekNumber });
    }
    default:
      return undefined;
  }
}

function capitalize(value: string, locale: string): string {
  return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);
}

type ActivityRow =
  | { key: string; kind: 'timeline'; sortAt: number; item: ClientTimelineItem }
  | { key: string; kind: 'conflict'; sortAt: number; conflict: OfflineSyncConflictDto };

function toTime(iso: string | undefined): number {
  const value = iso ? new Date(iso).getTime() : Number.NaN;
  return Number.isNaN(value) ? 0 : value;
}

/** Calendar day of the action, e.g. "27 Oct"; a plain `YYYY-MM-DD` is read as a local date. */
function formatLogDate(logDate: string | undefined, locale: string): string {
  if (!logDate) return '';
  const [year, month, day] = logDate.slice(0, 10).split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function ConflictRow({ conflict, locale, t }: { conflict: OfflineSyncConflictDto; locale: string; t: TFunction }) {
  const kind = conflict.kind === 'MealRemoved' ? 'MealRemoved' : 'PlanChanged';
  const occurred = conflict.occurredAt ? new Date(conflict.occurredAt) : null;
  const time =
    occurred && !Number.isNaN(occurred.getTime())
      ? occurred.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      : '';
  const meal = conflict.mealKind ? t(`mealKind.${conflict.mealKind}`) : '';
  const subject = t('clientDetail.overview.activity.conflict.subject', {
    meal,
    date: formatLogDate(conflict.logDate, locale),
  });
  return (
    <li
      data-testid="activity-conflict"
      data-kind={kind}
      data-reviewed={conflict.reviewedAt ? 'true' : 'false'}
      className="flex items-start gap-3 border-b border-border py-2 last:border-b-0"
    >
      <span className="flex size-7.5 shrink-0 items-center justify-center rounded-tile bg-caution-soft text-caution-ink">
        <History className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body text-ink-2">
          <b className="font-semibold">{t(`clientDetail.overview.activity.conflict.title.${kind}`)}</b>
          {` · ${subject}`}
        </span>
        <span className="text-meta text-muted-foreground">
          {t(`clientDetail.overview.activity.conflict.detail.${kind}`, {
            time,
            based: conflict.basedOnPlanVersion,
            current: conflict.currentPlanVersion,
          })}
        </span>
      </span>
      {conflict.detectedAt && (
        <span
          data-testid="activity-conflict-time"
          className="ml-auto pt-px text-meta whitespace-nowrap text-muted-foreground"
        >
          {capitalize(formatRelativeTime(conflict.detectedAt, locale), locale)}
        </span>
      )}
    </li>
  );
}

/** "Recent activity" card: the latest five timeline items, labelled from `type` and detailed from the payload. */
export default function RecentActivityCard({ clientId, role }: Props) {
  const { t, i18n } = useTranslation();
  const timelineQuery = useClientTimeline(clientId, { limit: ACTIVITY_LIMIT });
  // Offline-sync conflicts are a nutrition-plan feature; trainer-only viewers never query them.
  const conflictsQuery = useClientOfflineSyncConflicts(clientId, ACTIVITY_LIMIT, role !== 'trainer');
  const formatNumber = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);

  const timelineRows: ActivityRow[] = (timelineQuery.data?.items ?? [])
    .filter((item) => {
      if (role === 'trainer') return !NUTRITION_ONLY_TYPES.has(item.type);
      if (role === 'nutritionist') return !TRAINING_ONLY_TYPES.has(item.type);
      return true;
    })
    .map((item) => ({ key: item.id, kind: 'timeline', sortAt: toTime(item.occurredAt), item }));
  // A late-synced conflict ranks by when it was detected; the row itself shows when it happened.
  const conflictRows: ActivityRow[] = (conflictsQuery.data ?? []).map((conflict, index) => ({
    key: `conflict:${conflict.conflictId ?? index}`,
    kind: 'conflict',
    sortAt: toTime(conflict.detectedAt),
    conflict,
  }));
  // Unreviewed conflicts are pinned to the top; reviewed ones stay in chronological order with the rest.
  const isPinned = (row: ActivityRow) => row.kind === 'conflict' && !row.conflict.reviewedAt;
  const items = [...timelineRows, ...conflictRows]
    .sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || b.sortAt - a.sortAt)
    .slice(0, ACTIVITY_LIMIT);

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4.5 shadow-panel">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-copy font-semibold text-ink">{t('clientDetail.overview.activity.heading')}</h2>
        <span className="text-meta text-muted-foreground">{t('clientDetail.overview.activity.latest')}</span>
      </div>

      {timelineQuery.isPending && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}

      {!timelineQuery.isPending && timelineQuery.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-meta text-muted-foreground">{t('common.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void timelineQuery.refetch()}>
            {t('clients.retry')}
          </Button>
        </div>
      )}

      {!timelineQuery.isPending && !timelineQuery.isError && items.length === 0 && (
        <p className="text-meta text-muted-foreground">{t('clientDetail.overview.activity.empty')}</p>
      )}

      {!timelineQuery.isPending && !timelineQuery.isError && items.length > 0 && (
        <ul className="flex flex-col">
          {items.map((row) => {
            if (row.kind === 'conflict') {
              return <ConflictRow key={row.key} conflict={row.conflict} locale={i18n.language} t={t} />;
            }
            const item = row.item;
            const style = TYPE_STYLES[item.type] ?? FALLBACK_STYLE;
            const detail = activityDetail(item, t, formatNumber);
            return (
              <li key={row.key} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
                <span
                  className={`flex size-7.5 shrink-0 items-center justify-center rounded-tile ${TONE_CLASS[style.tone]}`}
                >
                  <style.Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 text-body text-ink-2">
                  <b className="font-semibold">{t(`clientDetail.overview.activity.type.${style.labelKey}`)}</b>
                  {detail && ` · ${detail}`}
                </span>
                <span className="ml-auto text-meta whitespace-nowrap text-muted-foreground">
                  {capitalize(formatRelativeTime(item.occurredAt, i18n.language), i18n.language)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Pencil, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ClientPlanItem } from '@/api/generated';
import {
  buildWeekStrip,
  formatShortDate,
  parseCalendarDate,
  todayCalendarDate,
  type PlanDetailState,
  type WeekSegmentState,
} from '@/components/client-detail/nutrition/nutritionPlanView';

interface Props {
  clientId: string;
  plan: ClientPlanItem;
  detail: PlanDetailState;
  onRetry: () => void;
}

const SEGMENT_CLASS: Record<WeekSegmentState, string> = {
  done: 'bg-nutrition',
  current: 'bg-error',
  upcoming: 'bg-nutrition-soft',
  draft: 'bg-muted',
};

const LEGEND: WeekSegmentState[] = ['done', 'current', 'upcoming', 'draft'];

/**
 * "Current meal plan" card: plan name, a one-line summary, a segment per week
 * (done / this week / published upcoming / draft) with its legend, and the
 * publishing warning. "Open editor" links to the client plan editor.
 */
export default function CurrentPlanCard({ clientId, plan, detail, onRetry }: Props) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const locale = i18n.language;
  const planDetail = detail.plan;

  const strip = planDetail ? buildWeekStrip(planDetail, todayCalendarDate()) : undefined;
  const startDate = parseCalendarDate(planDetail?.startDate ?? plan.periodStart);
  const dailyKcal = planDetail?.globalSettings?.dailyKcal;

  const summarySegments: string[] = [];
  if (strip && planDetail) {
    if (!strip.isScheduled) {
      summarySegments.push(t('clientDetail.nutrition.current.notScheduled'));
    } else if (strip.currentWeek !== undefined) {
      summarySegments.push(
        t('clientDetail.nutrition.current.weekOf', { week: strip.currentWeek, total: strip.weekCount }),
      );
    } else if (startDate) {
      summarySegments.push(t('clientDetail.nutrition.current.starts', { date: formatShortDate(startDate, locale) }));
    }
    if (dailyKcal) {
      summarySegments.push(t('clientDetail.nutrition.current.kcalPerDay', { kcal: dailyKcal.toLocaleString(locale) }));
    }
    if (plan.sourceTemplateId) {
      summarySegments.push(t('clientDetail.nutrition.current.madeFromTemplate'));
    }
    if (strip.isScheduled && strip.currentWeek !== undefined && startDate) {
      summarySegments.push(t('clientDetail.nutrition.current.started', { date: formatShortDate(startDate, locale) }));
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-nutrition-soft">
            <Utensils className="size-6 text-nutrition-ink" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-nutrition" />
              <span className="text-caption font-semibold uppercase tracking-wider text-nutrition-ink">
                {t('clientDetail.nutrition.current.label')}
              </span>
            </div>
            <h2 id={headingId} className="truncate text-title font-bold text-ink">
              {plan.name}
            </h2>
            <p className="text-body text-muted-foreground">
              {detail.isError
                ? t('common.loadError')
                : detail.isPending
                  ? t('common.loading')
                  : summarySegments.join(' · ')}
            </p>
          </div>
        </div>
        {plan.planId && (
          <Button asChild size="lg" className="gap-2">
            <Link to={`/clients/${clientId}/nutrition/plans/${plan.planId}`}>
              <Pencil className="size-4" aria-hidden="true" />
              {t('clientDetail.nutrition.current.openEditor')}
            </Link>
          </Button>
        )}
      </div>

      {detail.isPending && <Skeleton className="h-3 w-full" />}

      {detail.isError && (
        <div className="flex items-center gap-3">
          <p className="text-caption text-muted-foreground">{t('clientDetail.nutrition.current.detailError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t('clients.retry')}
          </Button>
        </div>
      )}

      {strip && (
        <div className="flex flex-col gap-3">
          <ol
            className="flex gap-1.5"
            aria-label={t('clientDetail.nutrition.current.stripLabel', { total: strip.weekCount })}
          >
            {strip.segments.map((segment) => (
              <li
                key={segment.weekNumber}
                data-state={segment.state}
                className={cn('h-2 min-w-0 flex-1 rounded-full', SEGMENT_CLASS[segment.state])}
                title={t(`clientDetail.nutrition.current.segment.${segment.state}`, { week: segment.weekNumber })}
              >
                <span className="sr-only">
                  {t(`clientDetail.nutrition.current.segment.${segment.state}`, { week: segment.weekNumber })}
                </span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {LEGEND.map((state) => (
                <li key={state} className="flex items-center gap-2 text-caption text-muted-foreground">
                  <span aria-hidden="true" className={cn('h-2 w-3.5 rounded-full', SEGMENT_CLASS[state])} />
                  {t(`clientDetail.nutrition.current.legend.${state}`)}
                </li>
              ))}
            </ul>
            {strip.needsPublishingWeek !== undefined && (
              <p className="text-caption font-semibold text-ink">
                {t('clientDetail.nutrition.current.needsPublishing', { week: strip.needsPublishingWeek })}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

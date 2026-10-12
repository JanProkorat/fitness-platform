import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientCheckInHistory } from '@/hooks/useWeeklyCheckIns';
import { toCheckInHistoryStatus, type CheckInHistoryStatus } from '@/api/weekly-checkins';
import { isoWeekNumber } from '@/lib/client-metrics';

interface Props {
  /** The client's ApplicationUser.Id (dashboard.clientUserId) — the history endpoint rejects the route PublicId. */
  clientUserId: string;
}

const HISTORY_WEEKS = 8;

const TILE_CLASS: Record<CheckInHistoryStatus, string> = {
  answered: 'bg-nutrition',
  missed: 'bg-marker',
  waiting: 'bg-line',
  none: 'border border-border bg-card',
};

/**
 * "Check-in trend" card: the last eight weekly check-in slots as coloured
 * tiles, a legend, and a footer for the newest week. Never names a weekday.
 */
export default function CheckInTrendCard({ clientUserId }: Props) {
  const { t, i18n } = useTranslation();
  const historyQuery = useClientCheckInHistory(clientUserId, HISTORY_WEEKS);

  const weeks = (historyQuery.data?.weeks ?? []).map((week) => ({
    weekStartDate: week.weekStartDate ?? '',
    status: toCheckInHistoryStatus(week.status),
    sentAt: week.sentAt ?? undefined,
  }));
  const isEmpty = weeks.every((week) => week.status === 'none') && (historyQuery.data?.totalCount ?? 0) === 0;
  // The history endpoint dates its newest week at the upcoming ISO Monday (the current
  // check-in cycle), so the last item is "this week" by contract, not by browser clock.
  const newest = weeks.length > 0 ? weeks[weeks.length - 1] : undefined;

  let footerStatus = '';
  if (newest) {
    const sentDate = newest.sentAt
      ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(new Date(newest.sentAt))
      : undefined;
    footerStatus = sentDate
      ? t(`clientDetail.overview.checkInTrend.footer.sent.${newest.status}`, { date: sentDate })
      : t(`clientDetail.overview.checkInTrend.footer.status.${newest.status}`);
  }

  return (
    <div className="flex h-full flex-col gap-3.5 rounded-2xl border border-border bg-card p-4.5 shadow-panel">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-copy font-semibold text-ink">{t('clientDetail.overview.checkInTrend.heading')}</h2>
        <span className="text-meta text-muted-foreground">
          {t('clientDetail.overview.checkInTrend.lastWeeks', { count: HISTORY_WEEKS })}
        </span>
      </div>

      {historyQuery.isPending && <Skeleton className="h-16 w-full" />}

      {!historyQuery.isPending && historyQuery.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-meta text-muted-foreground">{t('common.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void historyQuery.refetch()}>
            {t('clients.retry')}
          </Button>
        </div>
      )}

      {!historyQuery.isPending && !historyQuery.isError && isEmpty && (
        <p className="text-meta text-muted-foreground">{t('clientDetail.overview.checkInTrend.empty')}</p>
      )}

      {!historyQuery.isPending && !historyQuery.isError && !isEmpty && (
        <>
          <ol className="grid grid-cols-8 gap-1.5">
            {weeks.map((week, index) => {
              const isThisWeek = index === weeks.length - 1;
              const weekNumber = isoWeekNumber(week.weekStartDate);
              const label = isThisWeek
                ? t('clientDetail.overview.checkInTrend.thisWeek')
                : weekNumber != null
                  ? t('clientDetail.overview.checkInTrend.weekLabel', { week: weekNumber })
                  : '';
              return (
                <li key={week.weekStartDate || index} className="flex flex-col items-stretch gap-1.5">
                  <span
                    className={`h-7.5 rounded-sm ${TILE_CLASS[week.status]}`}
                    role="img"
                    aria-label={`${label}: ${t(`clientDetail.overview.checkInTrend.footer.status.${week.status}`)}`}
                  />
                  <span
                    className={
                      isThisWeek
                        ? 'text-center text-caption font-semibold text-ink'
                        : 'text-center text-caption text-muted-foreground'
                    }
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap items-center gap-4 text-meta text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-xs bg-nutrition" aria-hidden="true" />
              {t('clientDetail.overview.checkInTrend.legend.answered')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-xs bg-marker" aria-hidden="true" />
              {t('clientDetail.overview.checkInTrend.legend.missed')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-xs bg-line" aria-hidden="true" />
              {t('clientDetail.overview.checkInTrend.legend.waiting')}
            </span>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2.5 border-t border-border pt-3.5 text-body text-ink-2">
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-tile border border-border bg-card text-ink-2">
              <CalendarDays className="size-4" aria-hidden="true" />
            </span>
            <span>
              <b className="font-semibold">{t('clientDetail.overview.checkInTrend.footer.title')}</b>
              {' · '}
              {footerStatus}
            </span>
            <span className="ml-auto text-meta text-muted-foreground">
              {t('clientDetail.overview.checkInTrend.footer.overall', {
                answered: historyQuery.data?.answeredCount ?? 0,
                total: historyQuery.data?.totalCount ?? 0,
              })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

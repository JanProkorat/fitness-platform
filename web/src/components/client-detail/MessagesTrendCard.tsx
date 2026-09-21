import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getClientMessageStats } from '@/api/message-stats';

interface Props {
  clientId: string;
}

const WEEKS = 4;

/** Bar height as a percentage of the tallest bar in the chart, floored so a non-zero count still shows a sliver. */
function barHeightPercent(value: number, max: number): number {
  if (max <= 0 || value <= 0) {
    return 0;
  }
  return Math.max(4, Math.round((value / max) * 100));
}

/**
 * "Messages trend" widget (#1094) — the one card backed by a real new
 * endpoint (GET /trainer/clients/{clientId}/message-stats). Renders a
 * grouped bar chart, four weeks oldest-first, coach vs client message
 * counts. `role="img"` + an aria-label carry the accessible summary since
 * the bars themselves are decorative.
 */
export default function MessagesTrendCard({ clientId }: Props) {
  const { t } = useTranslation();

  const statsQuery = useQuery({
    queryKey: ['client-message-stats', clientId, WEEKS],
    queryFn: () => getClientMessageStats(clientId, WEEKS),
    enabled: Boolean(clientId),
  });

  const weeks = statsQuery.data ?? [];
  const maxCount = Math.max(1, ...weeks.flatMap((week) => [week.coachMessages ?? 0, week.clientMessages ?? 0]));

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-ink">{t('clientDetail.overview.messagesTrend.heading')}</h2>
        <span className="text-caption text-muted-foreground">{t('clientDetail.overview.messagesTrend.last4Weeks')}</span>
      </div>

      {statsQuery.isPending && <Skeleton className="h-32 w-full" />}

      {!statsQuery.isPending && statsQuery.isError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6">
          <p className="text-caption text-muted-foreground">{t('common.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void statsQuery.refetch()}>
            {t('clients.retry')}
          </Button>
        </div>
      )}

      {!statsQuery.isPending && !statsQuery.isError && (
        <div
          role="img"
          aria-label={t('clientDetail.overview.messagesTrend.chartAriaLabel')}
          className="flex flex-1 items-end justify-between gap-3"
        >
          {weeks.map((week, index) => (
            <div key={week.weekStart ?? index} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-24 items-end gap-1">
                <div
                  className="w-2.5 rounded-t-sm bg-muted-foreground"
                  style={{ height: `${barHeightPercent(week.coachMessages ?? 0, maxCount)}%` }}
                />
                <div
                  className="w-2.5 rounded-t-sm bg-line"
                  style={{ height: `${barHeightPercent(week.clientMessages ?? 0, maxCount)}%` }}
                />
              </div>
              <span className="text-caption text-muted-foreground">
                {t('clientDetail.overview.messagesTrend.weekLabel', { index: index + 1 })}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-caption text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-muted-foreground" aria-hidden="true" />
          {t('clientDetail.overview.messagesTrend.legend.coach')}
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-line" aria-hidden="true" />
          {t('clientDetail.overview.messagesTrend.legend.client')}
        </span>
      </div>
    </div>
  );
}

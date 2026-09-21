import { useTranslation } from 'react-i18next';
import TbdValue from '@/components/client-detail/TbdValue';

/**
 * "Check-in trend" widget (#1094) — entirely TBD. WeeklyCheckIn is strictly
 * weekly (unique on WeekStartDate); no daily grain exists anywhere, so the
 * wireframe's 15-cell daily grid has nothing to render. Renders the
 * heading, the legend, and the grid frame in a TBD state rather than
 * inventing daily data or hiding the widget.
 */
export default function CheckInTrendCard() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-ink">{t('clientDetail.overview.checkInTrend.heading')}</h2>
        <span className="text-caption text-muted-foreground">{t('clientDetail.overview.checkInTrend.last15Days')}</span>
      </div>

      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-8">
        <TbdValue className="text-body" />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-muted-foreground/40" aria-hidden="true" />
          {t('clientDetail.overview.checkInTrend.legend.completed')}
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-muted-foreground/40" aria-hidden="true" />
          {t('clientDetail.overview.checkInTrend.legend.missed')}
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-muted-foreground/40" aria-hidden="true" />
          {t('clientDetail.overview.checkInTrend.legend.upcoming')}
        </span>
      </div>
    </div>
  );
}

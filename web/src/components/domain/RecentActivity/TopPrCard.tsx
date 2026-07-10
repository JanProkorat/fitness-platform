import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatWeight } from '@/lib/personalRecordFormatters';
import { StatCardShell } from './StatCardShell';
import type { TopPrRecord } from './useRecentActivityAggregates';

interface TopPrCardProps {
  topPr: TopPrRecord | null;
  locale: 'cs' | 'en' | 'de';
}

export function TopPrCard({ topPr, locale }: TopPrCardProps) {
  const { t } = useTranslation();

  const weightLabel = useMemo(
    () => (topPr ? formatWeight(topPr.weightKg, locale) : ''),
    [topPr, locale],
  );

  return (
    <StatCardShell variant="accent" title={`🏆 ${t('clients.recentActivity.topPrMonth')}`}>
      {topPr ? (
        <>
          <div className="text-[13px] font-semibold text-text mb-1">
            {topPr.exerciseName}
          </div>
          <div
            className="text-[22px] font-bold leading-none tracking-tight"
            style={{ color: 'var(--accent)' }}
          >
            {weightLabel}
          </div>
          <div className="text-[12px] text-text3 mt-1">
            {topPr.date} · {t('clients.recentActivity.repsLabel', { count: topPr.reps })}
          </div>
        </>
      ) : (
        <div className="text-[13px] text-text3">
          {t('clients.recentActivity.noPrThisMonth')}
        </div>
      )}
    </StatCardShell>
  );
}

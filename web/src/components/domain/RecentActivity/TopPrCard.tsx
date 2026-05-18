import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatWeight } from '@/lib/personalRecordFormatters';
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
    <div
      className="rounded-md p-3 pb-3.5"
      style={{
        background: 'var(--accent-bg)',
        border: '1px solid var(--accent-br)',
      }}
    >
      <div className="text-[11px] text-text3 uppercase tracking-[0.04em] font-medium mb-1.5">
        🏆 {t('clients.recentActivity.topPrMonth')}
      </div>
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
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import type { ThisMonthAggregates } from './useRecentActivityAggregates';

interface ThisMonthCardProps {
  data: ThisMonthAggregates;
}

export function ThisMonthCard({ data }: ThisMonthCardProps) {
  const { t } = useTranslation();

  return (
    <div className="border border-border rounded-md p-3 pb-3.5">
      <div className="text-[11px] text-text3 uppercase tracking-[0.04em] font-medium mb-2.5">
        {t('clients.recentActivity.thisMonth')}
      </div>
      <div className="flex flex-col gap-1.5 text-[13px]">
        <div className="flex justify-between items-baseline">
          <span className="text-text2">🏆 {t('clients.recentActivity.prTotal')}</span>
          <span className="font-bold text-[15px] text-text">{data.prTotal}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-text2">🏋️ {t('clients.recentActivity.workoutsLabel')}</span>
          <span className="font-bold text-[15px] text-text">{data.workoutTotal}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-text2">📏 {t('clients.recentActivity.measurementsLabel')}</span>
          <span className="font-bold text-[15px] text-text">{data.measurementTotal}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-text2">🥗 {t('clients.recentActivity.completedDays')}</span>
          <span className="font-bold text-[15px] text-text">
            {data.completedDays} / {data.daysElapsedThisMonth}
          </span>
        </div>
      </div>
    </div>
  );
}

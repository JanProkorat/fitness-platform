import { useTranslation } from 'react-i18next';
import { StatCardShell } from './StatCardShell';
import type { ThisWeekAggregates } from './useRecentActivityAggregates';

interface ThisWeekCardProps {
  data: ThisWeekAggregates;
}

export function ThisWeekCard({ data }: ThisWeekCardProps) {
  const { t } = useTranslation();

  const complianceColorClass =
    data.compliancePercent !== null && data.compliancePercent >= 80
      ? 'text-green'
      : 'text-text';

  return (
    <StatCardShell title={t('clients.recentActivity.thisWeek')}>
      <div className="flex flex-col gap-1.5 text-[13px]">
        <div className="flex justify-between items-baseline">
          <span className="text-text2">🏋️ {t('clients.recentActivity.workoutsLabel')}</span>
          <span className="font-bold text-[15px] text-text">{data.workouts}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-text2">🏆 {t('clients.recentActivity.prLabel')}</span>
          <span className="font-bold text-[15px] text-text">{data.prs}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-text2">✓ {t('clients.recentActivity.complianceLabel')}</span>
          <span className={`font-bold text-[15px] ${complianceColorClass}`}>
            {data.compliancePercent !== null ? `${data.compliancePercent} %` : '—'}
          </span>
        </div>
      </div>
    </StatCardShell>
  );
}

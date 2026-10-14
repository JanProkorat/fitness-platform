import { useTranslation } from 'react-i18next';
import type { InfoPanelContext } from '@/components/plan-editor/PlanEditor';

/** The info tab of the client plan editor; the plan's details are added here. */
export default function ClientPlanInfoPanel({ weekNumber }: InfoPanelContext) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 p-4">
      <p className="text-label font-semibold tracking-label text-ink-2 uppercase">
        {t('planEditor.weeks.week', { number: weekNumber })}
      </p>
      <p className="text-body text-muted-foreground">{t('clientPlanEditor.info.placeholder')}</p>
    </div>
  );
}

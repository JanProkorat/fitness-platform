import { useTranslation } from 'react-i18next';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  disabled: boolean;
  /** Opens the same confirm as the menu's "Finish plan". */
  onFinish: () => void;
}

/** Shown above an Active plan whose last week is over: suggests finishing it. */
export default function PlanEndedBanner({ disabled, onFinish }: Props) {
  const { t } = useTranslation();
  return (
    <div
      role="note"
      data-testid="plan-ended-banner"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-nutrition bg-nutrition-soft px-4 py-3 text-body text-nutrition-ink"
    >
      <Flag className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{t('clientPlanEditor.ended.message')}</span>
      <Button type="button" size="sm" disabled={disabled} onClick={onFinish}>
        {t('clientPlanEditor.ended.action')}
      </Button>
    </div>
  );
}

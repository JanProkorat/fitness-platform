import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';
import { targetStatus } from '@/components/plan-editor/plan-editor-nutrition';

const STATUS_DOT_CLASS = {
  none: 'bg-ink',
  on: 'bg-success',
  near: 'bg-training-bright',
  off: 'bg-error',
} as const;

interface Props {
  kcal: number;
  target: number | undefined;
  className?: string;
}

/** A kcal value with its colour dot, shown against the daily target when there is one. */
export default function KcalReadout({ kcal, target, className }: Props) {
  const { t, i18n } = useTranslation();
  const status = targetStatus(kcal, target);

  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <span
        data-testid="kcal-status-dot"
        data-status={status}
        className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT_CLASS[status])}
        aria-hidden="true"
      />
      <span className="font-semibold">
        {target === undefined
          ? t('planEditor.averages.kcal', { value: formatKcal(kcal, i18n.language) })
          : t('planEditor.averages.kcalOfTarget', {
              value: formatKcal(kcal, i18n.language),
              target: formatKcal(target, i18n.language),
            })}
      </span>
    </span>
  );
}

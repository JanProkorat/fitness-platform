import { useTranslation } from 'react-i18next';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

/**
 * Calm empty state for a coach whose subscription does not include payments. Names no plan and
 * no price. Shared by the client Payment tab and Settings -> Payments.
 */
export default function PaymentsNotIncluded({ className }: Props) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      data-testid="payments-not-included"
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-line bg-card px-6 py-12 text-center shadow-panel',
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-sunken text-ink-2">
        <Wallet className="size-5" aria-hidden="true" />
      </span>
      <h2 className="text-panel-title font-semibold text-ink">{t('payments.notIncluded.title')}</h2>
      <p className="max-w-md text-copy text-muted-foreground">{t('payments.notIncluded.body')}</p>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ClientPaymentStatus, type ClientPaymentRowDto } from '@/api/client-payments';
import { daysBetween, formatShortDay, todayIso } from '@/lib/payment-format';

const CHIP_CLASS = 'text-meta font-semibold';

interface Props {
  row: ClientPaymentRowDto;
}

/** The status of one payment row: Upcoming, Requested, Overdue, Paid (with lateness) or Waived (with reason). */
export default function PaymentStatusChip({ row }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  switch (row.status) {
    case ClientPaymentStatus.Requested:
      return (
        <Badge variant="training" className={CHIP_CLASS}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {t('payments.client.status.requested')}
        </Badge>
      );
    case ClientPaymentStatus.Overdue: {
      const daysOverdue = row.dueDate ? Math.max(0, daysBetween(row.dueDate, todayIso())) : 0;
      return (
        <Badge variant="destructive" className={CHIP_CLASS}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {daysOverdue > 0
            ? t('payments.client.status.overdueDays', { count: daysOverdue })
            : t('payments.client.status.overdue')}
        </Badge>
      );
    }
    case ClientPaymentStatus.Paid: {
      const daysLate = row.dueDate && row.paidOn ? daysBetween(row.dueDate, row.paidOn) : 0;
      return (
        <Badge variant="success" className={`rounded-full ${CHIP_CLASS}`}>
          <Check aria-hidden="true" />
          {t('payments.client.status.paid', { date: formatShortDay(row.paidOn, language) })}
          {daysLate > 0 && ` · ${t('payments.client.status.daysLate', { count: daysLate })}`}
        </Badge>
      );
    }
    case ClientPaymentStatus.Waived:
      return (
        <Badge variant="secondary" className={`bg-sunken text-ink-2 ${CHIP_CLASS}`}>
          {row.waiveReason
            ? t('payments.client.status.waivedReason', { reason: row.waiveReason })
            : t('payments.client.status.waived')}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={`text-muted-foreground ${CHIP_CLASS}`}>
          {t('payments.client.status.upcoming')}
        </Badge>
      );
  }
}

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientPaymentStatus, type GetClientPaymentSummaryResponse } from '@/api/client-payments';
import { termsSummary } from '@/components/client-detail/payment/paymentModel';
import {
  formatFullDay,
  formatInstantDay,
  formatPaymentAmount,
  formatShortDay,
} from '@/lib/payment-format';

interface TileProps {
  label: string;
  value: ReactNode;
  detail: ReactNode;
}

function Tile({ label, value, detail }: TileProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-card px-4.5 py-4 shadow-panel">
      <span className="text-label font-semibold tracking-label text-muted-foreground uppercase">{label}</span>
      <span className="truncate text-stat font-semibold text-ink">{value}</span>
      <span className="text-meta text-muted-foreground">{detail}</span>
    </div>
  );
}

interface Props {
  summary: GetClientPaymentSummaryResponse;
  /** The collaboration is over: the package card says so instead of asking for a package. */
  ended?: boolean;
}

/** The three tiles above the payments: package, next payment and how far the client has paid. */
export default function PaymentSummaryCards({ summary, ended = false }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { terms, nextPayment } = summary;

  const nextDetail = nextPayment
    ? [
        nextPayment.status === ClientPaymentStatus.Overdue
          ? t('payments.client.summary.overdueSince', { date: formatShortDay(nextPayment.dueDate, language) })
          : t('payments.client.summary.due', { date: formatShortDay(nextPayment.dueDate, language) }),
        nextPayment.requestedAt
          ? t('payments.client.summary.requestedOn', { date: formatInstantDay(nextPayment.requestedAt, language) })
          : t('payments.client.summary.notRequested'),
      ].join(' · ')
    : t('payments.client.summary.nothingDue');

  return (
    <section
      aria-label={t('payments.client.summary.label')}
      className="grid grid-cols-1 gap-3.5 md:grid-cols-3"
      data-testid="payment-summary"
    >
      <Tile
        label={t('payments.client.summary.package')}
        value={terms?.packageName ?? t('payments.client.summary.noPackage')}
        detail={
          terms
            ? termsSummary(t, terms, language)
            : ended
              ? t('payments.client.summary.endedHint')
              : t('payments.client.summary.noPackageHint')
        }
      />
      <Tile
        label={t('payments.client.summary.nextPayment')}
        value={nextPayment ? formatPaymentAmount(nextPayment.amount, nextPayment.currency, language) : '—'}
        detail={nextDetail}
      />
      <Tile
        label={t('payments.client.summary.paidUntil')}
        value={summary.paidUntil ? formatFullDay(summary.paidUntil, language) : '—'}
        detail={[
          t('payments.client.summary.paidCount', { paid: summary.paidCount ?? 0, total: summary.totalCount ?? 0 }),
          t('payments.client.summary.clientSince', { date: formatInstantDay(summary.clientSince, language) }),
        ].join(' · ')}
      />
    </section>
  );
}

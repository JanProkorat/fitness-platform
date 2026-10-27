import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Send, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentCurrency, type ClientPaymentRowDto } from '@/api/client-payments';
import type { GetClientDashboardResponse } from '@/api/generated';
import {
  useClientPaymentHistory,
  useClientPaymentRows,
  useClientPaymentSummary,
} from '@/hooks/useClientPaymentQueries';
import { usePaymentSettings } from '@/hooks/usePaymentSettingsQueries';
import { getErrorStatus } from '@/lib/api-errors';
import { formatPeriodLabel } from '@/lib/payment-format';
import ChangeHistoryCard from '@/components/client-detail/payment/ChangeHistoryCard';
import MarkPaidDialog from '@/components/client-detail/payment/MarkPaidDialog';
import OneOffDialog from '@/components/client-detail/payment/OneOffDialog';
import PaymentsPaywall from '@/components/client-detail/payment/PaymentsPaywall';
import PaymentSummaryCards from '@/components/client-detail/payment/PaymentSummaryCards';
import PaymentsTable from '@/components/client-detail/payment/PaymentsTable';
import PriceCard from '@/components/client-detail/payment/PriceCard';
import RequestPaymentDrawer from '@/components/client-detail/payment/RequestPaymentDrawer';
import RequestsRemindersCard from '@/components/client-detail/payment/RequestsRemindersCard';
import WaiveDialog from '@/components/client-detail/payment/WaiveDialog';
import { isNotEntitled } from '@/components/client-detail/payment/paymentErrors';
import { requestablePayments } from '@/components/client-detail/payment/paymentModel';

const SKELETON_ROW_COUNT = 4;
const DEFAULT_DUE_DAYS = 7;

interface Props {
  clientId: string;
  /** Absent for an ended client, whose dashboard is gone; the name then comes from the payment summary. */
  dashboard?: GetClientDashboardResponse;
}

/**
 * Payment tab of the client detail page: package, next payment and progress, the payment list with
 * its mark-paid / waive / request actions, the client's price, and the coach's change history.
 */
export default function ClientPaymentTab({ clientId, dashboard }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const summaryQuery = useClientPaymentSummary(clientId);
  const entitled = summaryQuery.isSuccess;
  const rowsQuery = useClientPaymentRows(clientId, entitled);
  const historyQuery = useClientPaymentHistory(clientId, entitled);
  const settingsQuery = usePaymentSettings(entitled);

  const [markPaidRow, setMarkPaidRow] = useState<ClientPaymentRowDto | null>(null);
  const [waiveRow, setWaiveRow] = useState<ClientPaymentRowDto | null>(null);
  const [request, setRequest] = useState<{ paymentId: string | null } | null>(null);
  const [oneOffOpen, setOneOffOpen] = useState(false);

  const fallbackName = dashboard?.firstName?.trim() || t('clientDetail.photos.clientFallback');

  if (summaryQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (summaryQuery.isError) {
    if (isNotEntitled(summaryQuery.error)) {
      return <PaymentsPaywall />;
    }
    const notFound = getErrorStatus(summaryQuery.error) === 404;
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-16">
        <p className="text-body text-muted-foreground">
          {notFound ? t('payments.client.notFound', { name: fallbackName }) : t('payments.client.loadError')}
        </p>
        {!notFound && (
          <Button type="button" variant="outline" onClick={() => void summaryQuery.refetch()}>
            {t('payments.client.retry')}
          </Button>
        )}
      </div>
    );
  }

  const summary = summaryQuery.data;
  const ended = summary.collaborationEnded === true;
  const clientName = dashboard?.firstName?.trim() || summary.clientName?.trim() || fallbackName;
  const rows = rowsQuery.data ?? [];
  const requestable = requestablePayments(rows);
  const canRequest = summary.bankAccountSet === true;
  const defaultCurrency = summary.terms?.currency ?? settingsQuery.data?.profileCurrency ?? PaymentCurrency.CZK;
  const defaultDueDays = settingsQuery.data?.paymentDueDays ?? DEFAULT_DUE_DAYS;

  const periodLabelOf = (row: ClientPaymentRowDto | null): string =>
    row ? (row.title ?? formatPeriodLabel(row.periodStart, row.periodEnd, language)) : '';

  const openRequest = (paymentId: string | null) => setRequest({ paymentId });

  return (
    <div className="flex flex-col gap-4">
      {ended && (
        <p data-testid="collaboration-ended" className="text-body text-muted-foreground">
          {t('payments.client.ended')}
        </p>
      )}
      <PaymentSummaryCards summary={summary} ended={ended} />

      {/* The price column sits beside the table only where the table still fits unscrolled. */}
      <div className="grid grid-cols-1 items-start gap-3.5 min-[1440px]:grid-cols-[minmax(0,1fr)_23.75rem]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-copy font-semibold text-ink">{t('payments.client.list.title')}</h2>
            <span className="ml-auto flex flex-wrap gap-2">
              {!ended && (
                <Button type="button" variant="outline" size="lg" className="px-3.5 font-semibold" onClick={() => setOneOffOpen(true)}>
                  <Plus aria-hidden="true" />
                  {t('payments.client.list.addOneOff')}
                </Button>
              )}
              <Button
                type="button"
                size="lg"
                className="px-3.5 font-semibold"
                disabled={!canRequest || requestable.length === 0}
                onClick={() => openRequest(summary.nextPayment?.paymentId ?? requestable[0]?.paymentId ?? null)}
              >
                <Send aria-hidden="true" />
                {t('payments.client.list.request')}
              </Button>
            </span>
          </div>

          {!canRequest && (
            <div
              role="alert"
              data-testid="bank-account-warning"
              className="flex items-start gap-2.5 rounded-field bg-training-soft px-3.5 py-3 text-body text-training-ink"
            >
              <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
              <span>
                {t('payments.client.list.noBankAccount')}{' '}
                <Link to="/settings" className="font-semibold underline underline-offset-2">
                  {t('payments.client.list.openSettings')}
                </Link>
              </span>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-panel">
            {rowsQuery.isPending ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : rowsQuery.isError ? (
              <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10">
                <p className="text-body text-muted-foreground">{t('payments.client.list.loadError')}</p>
                <Button type="button" variant="outline" onClick={() => void rowsQuery.refetch()}>
                  {t('payments.client.retry')}
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-body text-muted-foreground">
                {t('payments.client.list.empty', { name: clientName })}
              </p>
            ) : (
              <PaymentsTable
                rows={rows}
                canRequest={canRequest}
                onMarkPaid={setMarkPaidRow}
                onRequest={(row) => openRequest(row.paymentId ?? null)}
                onWaive={setWaiveRow}
              />
            )}
            <p className="border-t border-line px-5 py-3.5 text-meta text-muted-foreground">
              {t('payments.client.list.footnote', { name: clientName })}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          {!ended && <PriceCard clientId={clientId} clientName={clientName} summary={summary} />}
          <RequestsRemindersCard clientId={clientId} />
          {historyQuery.isPending ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (
            <ChangeHistoryCard entries={historyQuery.data ?? []} />
          )}
        </div>
      </div>

      <MarkPaidDialog
        clientId={clientId}
        clientName={clientName}
        row={markPaidRow}
        periodLabel={periodLabelOf(markPaidRow)}
        onClose={() => setMarkPaidRow(null)}
      />
      <WaiveDialog
        clientId={clientId}
        clientName={clientName}
        row={waiveRow}
        periodLabel={periodLabelOf(waiveRow)}
        onClose={() => setWaiveRow(null)}
      />
      {!ended && (
        <OneOffDialog
          open={oneOffOpen}
          onOpenChange={setOneOffOpen}
          clientId={clientId}
          clientName={clientName}
          defaultCurrency={defaultCurrency}
          defaultDueDays={defaultDueDays}
        />
      )}
      <RequestPaymentDrawer
        open={request !== null}
        onOpenChange={(open) => !open && setRequest(null)}
        clientId={clientId}
        clientName={clientName}
        rows={requestable}
        initialPaymentId={request?.paymentId ?? null}
      />
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useClientPaymentSummary } from '@/hooks/useClientPaymentQueries';
import ClientPaymentTab from '@/components/client-detail/payment/ClientPaymentTab';

interface Props {
  clientId: string;
}

/**
 * Payment view of a client whose collaboration ended. The client dashboard is gone, so there is no
 * detail header or tab row: just the client's name and the payment tab, which hides what an ended
 * link no longer allows.
 */
export default function EndedClientPaymentView({ clientId }: Props) {
  const { t } = useTranslation();
  // Shares the cache entry the payment tab reads, so this adds no request.
  const summaryQuery = useClientPaymentSummary(clientId);
  const name = summaryQuery.data?.clientName?.trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Link
          to="/clients"
          className="inline-flex w-fit items-center gap-1.5 text-body text-muted-foreground hover:text-ink hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('clients.backToClients')}
        </Link>
        {name && <h1 className="font-display text-title font-semibold text-ink">{name}</h1>}
      </div>
      <ClientPaymentTab clientId={clientId} />
    </div>
  );
}

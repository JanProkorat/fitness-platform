import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import OnboardingAnswersCard from '@/components/inbox/panel/OnboardingAnswersCard';
import { PanelLoadError, PanelStatusHeader } from '@/components/inbox/panel/PanelPrimitives';
import { useIncomingRequests } from '@/hooks/useClientsQueries';

interface Props {
  name: string;
  /** Public id of the pending request (the conversation's `cooperation.sourceId`). */
  sourceId: string;
  clientPublicId?: string;
}

/**
 * Right panel for a client whose request is still pending: a Pending chip and
 * the onboarding answers carried by the incoming request, matched on the
 * request id or the client's profile id.
 */
export default function PendingClientPanel({ name, sourceId, clientPublicId }: Props) {
  const { t } = useTranslation();
  const requestsQuery = useIncomingRequests();
  const request = requestsQuery.data?.find(
    (r) => r.publicId === sourceId || (clientPublicId !== undefined && r.clientPublicId === clientPublicId),
  );

  return (
    <div data-testid="pending-client-panel" className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4.5 py-5.5">
      <PanelStatusHeader
        name={name}
        chip={t('inbox.panel.pendingChip')}
        chipDotClassName="bg-marker-solid"
        description={t('inbox.panel.pendingLine')}
      />
      {requestsQuery.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : requestsQuery.isError ? (
        <PanelLoadError onRetry={() => void requestsQuery.refetch()} />
      ) : request ? (
        <OnboardingAnswersCard request={request} />
      ) : null}
    </div>
  );
}

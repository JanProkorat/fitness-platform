import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import InviteSummaryCard from '@/components/inbox/panel/InviteSummaryCard';
import { PanelLoadError, PanelStatusHeader } from '@/components/inbox/panel/PanelPrimitives';
import { PendingRowKind } from '@/api/clients';
import { usePendingClients } from '@/hooks/useClientsQueries';
import { firstName } from '@/lib/cooperationCards';

interface Props {
  name: string;
  /** Public id of the pending invite (the conversation's `cooperation.sourceId`). */
  sourceId: string;
}

/**
 * Right panel for a client who was invited but has not accepted: an Invited
 * chip, "waiting for <name>", and the invite's email, sent date and expiry
 * from the coach's pending rows.
 */
export default function InvitedClientPanel({ name, sourceId }: Props) {
  const { t } = useTranslation();
  const pendingQuery = usePendingClients();
  const invite = pendingQuery.data?.find((row) => row.kind === PendingRowKind.Invite && row.publicId === sourceId);

  return (
    <div data-testid="invited-client-panel" className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4.5 py-5.5">
      <PanelStatusHeader
        name={name}
        chip={t('inbox.panel.invitedChip')}
        chipDotClassName="bg-muted-foreground"
        description={t('inbox.panel.invitedLine', { name: firstName(name) })}
      />
      {pendingQuery.isPending ? (
        <Skeleton className="h-36 w-full" />
      ) : pendingQuery.isError ? (
        <PanelLoadError onRetry={() => void pendingQuery.refetch()} />
      ) : (
        <InviteSummaryCard email={invite?.email} sentAt={invite?.sentAt} />
      )}
    </div>
  );
}

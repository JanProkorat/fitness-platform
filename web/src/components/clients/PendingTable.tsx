import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PendingRowKind, type PendingClientRow } from '@/api/clients';
import {
  useAcceptClientRequest,
  useCancelPendingInvite,
  useRejectClientRequest,
} from '@/hooks/useClientsQueries';

const COLUMN_COUNT = 5;
const SKELETON_ROW_COUNT = 3;

interface Props {
  rows: PendingClientRow[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}

/**
 * The Pending tab's table. Deliberately its own component, not a variant of
 * `ClientsTable`: a `PendingClientRow` shares only a name and an email with
 * `ClientSummary` — no avatar, status, tags, unread count or plans, and its
 * id means a different thing depending on `kind` (PendingInvite.PublicId vs
 * ClientRequest.PublicId). It is also unpaginated, so there is no pagination
 * control on this tab. Which action a row gets depends on `kind`: an Invite
 * row can only be cancelled (the trainer sent it); a Request row can be
 * accepted or rejected (the client sent it).
 */
export default function PendingTable({ rows, isPending, isError, onRetry }: Props) {
  const { t } = useTranslation();
  const cancelMutation = useCancelPendingInvite();
  const acceptMutation = useAcceptClientRequest();
  const rejectMutation = useRejectClientRequest();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('clients.pendingTable.columnName')}</TableHead>
          <TableHead>{t('clients.pendingTable.columnEmail')}</TableHead>
          <TableHead>{t('clients.pendingTable.columnType')}</TableHead>
          <TableHead>{t('clients.pendingTable.columnSentAt')}</TableHead>
          <TableHead className="w-40">
            <span className="sr-only">{t('common.actions')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isPending &&
          Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
            <TableRow key={index}>
              <TableCell colSpan={COLUMN_COUNT}>
                <Skeleton className="h-10 w-full" />
              </TableCell>
            </TableRow>
          ))}

        {!isPending && isError && (
          <TableRow>
            <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center">
              <div className="flex flex-col items-center gap-3">
                <p className="text-body text-muted-foreground">{t('common.loadError')}</p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  {t('clients.retry')}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        )}

        {!isPending && !isError && rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center">
              <p className="text-body text-muted-foreground">{t('clients.pendingTable.empty')}</p>
            </TableCell>
          </TableRow>
        )}

        {!isPending &&
          !isError &&
          rows.map((row) => {
            const publicId = row.publicId ?? '';
            const isCancelling = cancelMutation.isPending && cancelMutation.variables === publicId;
            const isAccepting = acceptMutation.isPending && acceptMutation.variables?.publicId === publicId;
            const isRejecting = rejectMutation.isPending && rejectMutation.variables?.publicId === publicId;

            return (
              <TableRow key={`${row.kind}-${row.publicId}`}>
                <TableCell>
                  <span className="font-medium text-foreground">
                    {row.firstName} {row.lastName}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.email}</TableCell>
                <TableCell>
                  <Badge variant={row.kind === PendingRowKind.Request ? 'secondary' : 'outline'}>
                    {row.kind === PendingRowKind.Request
                      ? t('clients.pendingTable.kindRequest')
                      : t('clients.pendingTable.kindInvite')}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.sentAt ? new Date(row.sentAt).toLocaleDateString() : null}
                </TableCell>
                <TableCell>
                  {row.kind === PendingRowKind.Request ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!publicId || isAccepting || isRejecting}
                        onClick={() => acceptMutation.mutate({ publicId })}
                      >
                        {isAccepting ? t('common.saving') : t('clients.pendingTable.accept')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!publicId || isAccepting || isRejecting}
                        onClick={() => rejectMutation.mutate({ publicId })}
                      >
                        {isRejecting ? t('common.saving') : t('clients.pendingTable.reject')}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!publicId || isCancelling}
                        onClick={() => cancelMutation.mutate(publicId)}
                      >
                        {isCancelling ? t('common.saving') : t('clients.pendingTable.cancel')}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}

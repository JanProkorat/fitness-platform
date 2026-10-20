import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import ClientAvatar from '@/components/clients/ClientAvatar';
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
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** A request counts as new for this long after it was sent. */
const NEW_REQUEST_WINDOW_MS = MS_PER_DAY;

function isNewRequest(row: PendingClientRow): boolean {
  if (row.kind !== PendingRowKind.Request || !row.sentAt) return false;
  const age = Date.now() - new Date(row.sentAt).getTime();
  return age >= 0 && age < NEW_REQUEST_WINDOW_MS;
}

/** The time of day for today, a relative phrase ("3 days ago") otherwise. */
function formatSent(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  const days = Math.max(1, Math.floor((Date.now() - date.getTime()) / MS_PER_DAY));
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day');
}

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
 * accepted or rejected (the client sent it). Invite rows no longer carry a
 * name (email-only invites), so the name column falls back to the email
 * for them; Request rows still carry a real registered-user name.
 */
export default function PendingTable({ rows, isPending, isError, onRetry }: Props) {
  const { t, i18n } = useTranslation();
  const cancelMutation = useCancelPendingInvite();
  const acceptMutation = useAcceptClientRequest();
  const rejectMutation = useRejectClientRequest();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('clients.pendingTable.columnName')}</TableHead>
          <TableHead>{t('clients.pendingTable.columnType')}</TableHead>
          <TableHead>{t('clients.pendingTable.columnMessage')}</TableHead>
          <TableHead>{t('clients.pendingTable.columnSentAt')}</TableHead>
          <TableHead className="w-56">
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
            const isRequest = row.kind === PendingRowKind.Request;
            const isNew = isNewRequest(row);
            const isCancelling = cancelMutation.isPending && cancelMutation.variables === publicId;
            const isAccepting = acceptMutation.isPending && acceptMutation.variables?.publicId === publicId;
            const isRejecting = rejectMutation.isPending && rejectMutation.variables?.publicId === publicId;
            const displayName = row.firstName || row.lastName ? `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() : row.email;
            const message = row.message || (isRequest ? '' : t('clients.pendingTable.waitingFor', { name: displayName }));

            return (
              <TableRow key={`${row.kind}-${row.publicId}`} data-new={isNew || undefined} className={cn(isNew && 'bg-marker/5')}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <ClientAvatar firstName={row.firstName || row.email} lastName={row.lastName} />
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{displayName}</span>
                        {isNew && (
                          <span
                            data-testid="pending-new-marker"
                            className="rounded-sm bg-marker/10 px-1.5 py-0.5 text-label font-semibold text-marker-text"
                          >
                            {t('clients.pendingTable.newMarker')}
                          </span>
                        )}
                      </span>
                      {displayName !== row.email && <span className="text-body text-muted-foreground">{row.email}</span>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1.5">
                    <span
                      aria-hidden="true"
                      className={cn('size-1.5 rounded-full', isRequest ? 'bg-marker-solid' : 'bg-muted-foreground')}
                    />
                    {isRequest ? t('clients.pendingTable.kindRequest') : t('clients.pendingTable.kindInvite')}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md truncate text-muted-foreground">{message}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.sentAt ? formatSent(row.sentAt, i18n.language) : null}
                </TableCell>
                <TableCell>
                  {isRequest ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!publicId || isAccepting || isRejecting}
                        onClick={() => acceptMutation.mutate({ publicId })}
                      >
                        {!isAccepting && <Check aria-hidden="true" />}
                        {isAccepting ? t('common.saving') : t('clients.pendingTable.accept')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
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
                        variant="outline"
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

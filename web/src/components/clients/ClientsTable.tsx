import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClientSummary } from '@/api/clients';
import ClientAvatar from '@/components/clients/ClientAvatar';
import ClientStatusBadge from '@/components/clients/ClientStatusBadge';
import ClientTagPill from '@/components/clients/ClientTagPill';
import ClientTagPickerPopover from '@/components/clients/ClientTagPickerPopover';
import PlanIconsCell from '@/components/clients/PlanIconsCell';
import ClientRowMenu from '@/components/clients/ClientRowMenu';
import ClientsEmptyState from '@/components/clients/ClientsEmptyState';

const COLUMN_COUNT = 7;
const SKELETON_ROW_COUNT = 5;

interface Props {
  clients: ClientSummary[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  onInviteClient: () => void;
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
}

/** The Active/Paused/Archived tabs' table. See PendingTable for the Pending tab. */
export default function ClientsTable({
  clients,
  isPending,
  isError,
  onRetry,
  hasActiveFilter,
  onClearFilters,
  onInviteClient,
  selectedIds,
  onToggleRow,
  onToggleAll,
}: Props) {
  const { t } = useTranslation();

  const pageRowIds = clients.map((client) => client.publicId ?? '').filter(Boolean);
  const allSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && pageRowIds.some((id) => selectedIds.has(id));

  return (
    <Table>
      <TableHeader className="bg-muted">
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={() => onToggleAll(pageRowIds)}
              aria-label={t('clients.table.selectAll')}
              disabled={pageRowIds.length === 0}
            />
          </TableHead>
          <TableHead>{t('clients.table.columnClient')}</TableHead>
          <TableHead>{t('clients.table.columnStatus')}</TableHead>
          <TableHead>{t('clients.table.columnTags')}</TableHead>
          <TableHead className="text-center">{t('clients.table.columnUnread')}</TableHead>
          <TableHead>{t('clients.table.columnPlans')}</TableHead>
          <TableHead className="w-10">
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

        {!isPending && !isError && clients.length === 0 && (
          <TableRow>
            <TableCell colSpan={COLUMN_COUNT}>
              <ClientsEmptyState
                hasActiveFilter={hasActiveFilter}
                onClearFilters={onClearFilters}
                onInviteClient={onInviteClient}
              />
            </TableCell>
          </TableRow>
        )}

        {!isPending &&
          !isError &&
          clients.map((client) => {
            const rowId = client.publicId ?? '';
            return (
              <TableRow key={client.publicId}>
                <TableCell>
                  <Checkbox
                    checked={Boolean(rowId) && selectedIds.has(rowId)}
                    onCheckedChange={() => rowId && onToggleRow(rowId)}
                    disabled={!rowId}
                    aria-label={t('clients.table.selectRow', {
                      name: `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim(),
                    })}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <ClientAvatar
                      firstName={client.firstName}
                      lastName={client.lastName}
                      avatarBlobUrl={client.avatarBlobUrl}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {client.firstName} {client.lastName}
                      </span>
                      <span className="text-caption text-muted-foreground">{client.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <ClientStatusBadge status={client.status} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    {(client.tags ?? []).map((tag) => (
                      <ClientTagPill key={tag.tagId} tag={tag} />
                    ))}
                    <ClientTagPickerPopover client={client} />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {(client.unreadMessageCount ?? 0) > 0 && (
                    <span
                      className="inline-flex items-center gap-1 text-primary"
                      title={t('clients.table.unreadTooltip', { count: client.unreadMessageCount ?? 0 })}
                      aria-label={t('clients.table.unreadTooltip', { count: client.unreadMessageCount ?? 0 })}
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />
                      {client.unreadMessageCount}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <PlanIconsCell activePlans={client.activePlans ?? []} />
                </TableCell>
                <TableCell>
                  <ClientRowMenu />
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}

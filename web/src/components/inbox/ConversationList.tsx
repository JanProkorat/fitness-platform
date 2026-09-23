import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ConversationFilterMenu from '@/components/inbox/ConversationFilterMenu';
import ConversationRow from '@/components/inbox/ConversationRow';
import InboxSearch from '@/components/inbox/InboxSearch';
import type { ClientListFilter, ConversationDto, GetConversationFilterCountsResponse } from '@/api/generated';

interface Props {
  archived: boolean;
  onArchivedChange: (archived: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  filter: ClientListFilter;
  onFilterChange: (filter: ClientListFilter) => void;
  counts?: GetConversationFilterCountsResponse;
  conversations: ConversationDto[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedParticipantId?: string;
  onSelectConversation: (conversation: ConversationDto) => void;
}

/**
 * The inbox's left pane (~235px, docs/design/1095/inbox-inventory.md):
 * title + Active/Archived view switch, search, the filter dropdown, and
 * the row list. Search is client-side over the already-loaded
 * `conversations` list, matching by participant name — there is no server
 * search for conversations.
 */
export default function ConversationList({
  archived,
  onArchivedChange,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  counts,
  conversations,
  isPending,
  isError,
  onRetry,
  selectedParticipantId,
  onSelectConversation,
}: Props) {
  const { t } = useTranslation();

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return conversations;
    }
    return conversations.filter((conversation) => conversation.participant?.name?.toLowerCase().includes(query));
  }, [conversations, search]);

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-border">
      <div className="flex items-center justify-between gap-2 p-4 pb-3">
        <h1 className="text-title font-bold text-ink">{t('sidebar.inbox')}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="gap-1 px-1.5 text-caption text-muted-foreground">
              {archived ? t('inbox.archivedView') : t('inbox.activeView')}
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onArchivedChange(false)}>{t('inbox.activeView')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onArchivedChange(true)}>{t('inbox.archivedView')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-2 px-4 pb-3">
        <InboxSearch value={search} onChange={onSearchChange} />
        <ConversationFilterMenu active={filter} counts={counts} onSelect={onFilterChange} />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isPending && (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {!isPending && isError && (
          <div className="flex flex-col items-center gap-2 py-8">
            <p className="text-caption text-muted-foreground">{t('inbox.loadError')}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              {t('clients.retry')}
            </Button>
          </div>
        )}

        {!isPending && !isError && filteredConversations.length === 0 && (
          <p className="px-2 py-8 text-center text-caption text-muted-foreground">{t('inbox.noConversations')}</p>
        )}

        {!isPending &&
          !isError &&
          filteredConversations.map((conversation) => (
            <ConversationRow
              key={conversation.participant?.id ?? conversation.id}
              conversation={conversation}
              isSelected={Boolean(conversation.participant?.id) && conversation.participant?.id === selectedParticipantId}
              onSelect={() => onSelectConversation(conversation)}
            />
          ))}
      </div>
    </div>
  );
}

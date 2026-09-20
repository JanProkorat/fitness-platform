import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ClientListFilter, type ClientTabCounts } from '@/api/generated';
import { useClientListParams, type ClientListTab } from '@/hooks/useClientListParams';
import { useClients, usePendingClients } from '@/hooks/useClientsQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import ClientFilterChips from '@/components/clients/ClientFilterChips';
import ClientTagFilterPopover from '@/components/clients/ClientTagFilterPopover';
import ClientsTable from '@/components/clients/ClientsTable';
import PendingTable from '@/components/clients/PendingTable';
import ClientsPagination from '@/components/clients/ClientsPagination';

const TAB_ORDER: ClientListTab[] = ['Active', 'Paused', 'Archived', 'Pending'];

const TAB_LABEL_KEY: Record<ClientListTab, string> = {
  Active: 'clients.tabs.active',
  Paused: 'clients.tabs.paused',
  Archived: 'clients.tabs.archived',
  Pending: 'clients.tabs.pending',
};

const TAB_COUNT_KEY: Record<ClientListTab, keyof ClientTabCounts> = {
  Active: 'active',
  Paused: 'paused',
  Archived: 'archived',
  Pending: 'pending',
};

/**
 * The trainer-portal Clients page — tabs, search, filter chips, tag filter,
 * the client table, and pagination. See PLAN-1066-clients-page.md §2-3 for
 * the phased build (this is phase 3) and the design decisions behind the
 * URL-as-state-of-record model consumed via `useClientListParams`.
 */
export default function ClientsPage() {
  const { t } = useTranslation();
  const { filters, setSearch, setTab, setChip, setTagIds, setPage, clearFilters } = useClientListParams();

  const [searchInput, setSearchInput] = useState(filters.search);

  // Re-sync the local input when the URL's search value changes from
  // elsewhere (browser back/forward, clearFilters, a hand-edited URL).
  // Adjusted during render rather than in a useEffect — React's own
  // "adjusting state when a prop changes" pattern
  // (https://react.dev/learn/you-might-not-need-an-effect) — so a
  // clearFilters click clears the visible box in the same render instead
  // of flashing stale text for one frame.
  const [syncedSearch, setSyncedSearch] = useState(filters.search);
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search);
    setSearchInput(filters.search);
  }

  // Fires 300ms after the last keystroke settles; `setSearch` itself resets
  // page to 1 and uses `replace` so Back doesn't walk one step per keystroke.
  useDebouncedValue(searchInput, 300, () => {
    setSearch(searchInput);
  });

  const isPendingTab = filters.tab === 'Pending';

  // Deliberately enabled on every tab, including Pending — tab/chip counts
  // live only on this response (see useClients' own doc comment). Do not
  // gate this query on `!isPendingTab`.
  const clientsQuery = useClients(filters);
  const pendingQuery = usePendingClients();

  const tabCounts = clientsQuery.data?.tabCounts;
  const hasActiveFilter =
    filters.search !== '' || filters.chip !== ClientListFilter.All || filters.tagIds.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-bold text-ink">{t('clients.title')}</h1>
        <p className="text-body text-muted-foreground">{t('clients.subtitle')}</p>
      </div>

      <Tabs value={filters.tab} onValueChange={(value) => setTab(value as ClientListTab)}>
        <TabsList>
          {TAB_ORDER.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="gap-1.5">
              {t(TAB_LABEL_KEY[tab])}
              {tabCounts && <Badge variant="secondary">{tabCounts[TAB_COUNT_KEY[tab]] ?? 0}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!isPendingTab && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t('clients.searchPlaceholder')}
                className="pl-8"
                aria-label={t('clients.searchPlaceholder')}
              />
            </div>
            <ClientTagFilterPopover selectedTagIds={filters.tagIds} onChange={setTagIds} />
          </div>

          <ClientFilterChips active={filters.chip} counts={clientsQuery.data?.filterCounts} onSelect={setChip} />
        </div>
      )}

      {isPendingTab ? (
        <PendingTable
          rows={pendingQuery.data ?? []}
          isPending={pendingQuery.isPending}
          isError={pendingQuery.isError}
          onRetry={() => void pendingQuery.refetch()}
        />
      ) : (
        <>
          <ClientsTable
            clients={clientsQuery.data?.clients ?? []}
            isPending={clientsQuery.isPending}
            isError={clientsQuery.isError}
            onRetry={() => void clientsQuery.refetch()}
            hasActiveFilter={hasActiveFilter}
            onClearFilters={clearFilters}
          />
          <ClientsPagination
            page={filters.page}
            pageSize={filters.pageSize}
            totalCount={clientsQuery.data?.totalCount ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientListFilter, type ClientTabCounts } from '@/api/generated';
import { useClientListParams, type ClientListTab } from '@/hooks/useClientListParams';
import { useClients, usePendingClients } from '@/hooks/useClientsQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import ClientFilterChips from '@/components/clients/ClientFilterChips';
import ClientTagFilterPopover from '@/components/clients/ClientTagFilterPopover';
import ClientsTable from '@/components/clients/ClientsTable';
import PendingTable from '@/components/clients/PendingTable';
import ClientsPagination from '@/components/clients/ClientsPagination';
import ClientSelectionBar from '@/components/clients/ClientSelectionBar';
import BroadcastDrawer from '@/components/clients/BroadcastDrawer';
import AddClientDrawer from '@/components/clients/AddClientDrawer';

// Order matches the Figma wireframe (frame client-list-02, #1066 phase 6):
// Active, Pending, Paused, Ended — "Ended" was renamed "Archived" earlier
// in this issue, which is settled; only the ORDER changes here.
const TAB_ORDER: ClientListTab[] = ['Active', 'Pending', 'Paused', 'Archived'];

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);

  // Selection is page-local UI state, not a URL filter — clear it whenever
  // the tab changes so a stale selection can't keep the bulk bar alive over
  // rows that can no longer receive a broadcast (e.g. switching to Pending,
  // which has no selection at all). Adjusted during render, same pattern as
  // `syncedSearch` above — React's own "adjusting state when a prop changes"
  // pattern — rather than a useEffect, which would call setState after an
  // extra commit and trigger a second, avoidable render.
  const [selectionTab, setSelectionTab] = useState(filters.tab);
  if (filters.tab !== selectionTab) {
    setSelectionTab(filters.tab);
    setSelectedIds(new Set());
  }

  function toggleRow(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll(ids: string[]) {
    setSelectedIds((previous) => {
      const allSelected = ids.length > 0 && ids.every((id) => previous.has(id));
      if (allSelected) {
        const next = new Set(previous);
        for (const id of ids) {
          next.delete(id);
        }
        return next;
      }
      return new Set([...previous, ...ids]);
    });
  }

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
  //
  // The equality guard is load-bearing, not a micro-optimisation: the debounce
  // effect runs once on mount regardless of whether the value changed, and
  // `setSearch` clears `page`. Without it, opening /clients?page=2 from a
  // bookmark or a shared link silently snapped back to page 1 after 300ms.
  useDebouncedValue(searchInput, 300, () => {
    if (searchInput !== filters.search) {
      setSearch(searchInput);
    }
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title font-bold text-ink">{t('clients.title')}</h1>
          <p className="text-body text-muted-foreground">{t('clients.subtitle')}</p>
        </div>
        <Button type="button" onClick={() => setAddClientOpen(true)}>
          {t('clients.inviteClient')}
        </Button>
      </div>

      <Tabs value={filters.tab} onValueChange={(value) => setTab(value as ClientListTab)}>
        {/* Below the width where all four tabs fit (phone-width shell fix,
            see PLAN-1066-clients-page.md phase 5), the row scrolls within
            its own container instead of being clipped by the shell's
            `overflow-x-hidden` main region — a clipped-but-not-scrollable
            "Pending" tab would be unreachable rather than merely narrow. */}
        <div className="overflow-x-auto">
          <TabsList variant="underline">
            {TAB_ORDER.map((tab) => {
              const isActiveTab = filters.tab === tab;
              return (
                <TabsTrigger key={tab} value={tab} variant="underline" className="gap-1.5">
                  {t(TAB_LABEL_KEY[tab])}
                  {tabCounts && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-label font-semibold',
                        isActiveTab ? 'bg-primary text-primary-foreground' : 'bg-line text-muted-foreground',
                      )}
                    >
                      {tabCounts[TAB_COUNT_KEY[tab]] ?? 0}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </Tabs>

      {!isPendingTab && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ClientsTable
            clients={clientsQuery.data?.clients ?? []}
            isPending={clientsQuery.isPending}
            isError={clientsQuery.isError}
            onRetry={() => void clientsQuery.refetch()}
            hasActiveFilter={hasActiveFilter}
            onClearFilters={clearFilters}
            onInviteClient={() => setAddClientOpen(true)}
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
          />
          <ClientsPagination
            rowCount={(clientsQuery.data?.clients ?? []).length}
            page={filters.page}
            pageSize={filters.pageSize}
            totalCount={clientsQuery.data?.totalCount ?? 0}
            onPageChange={setPage}
          />
        </div>
      )}

      <ClientSelectionBar
        count={selectedIds.size}
        onBroadcast={() => setBroadcastOpen(true)}
        onCancel={() => setSelectedIds(new Set())}
      />
      <BroadcastDrawer
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
        clientPublicIds={[...selectedIds]}
        onSent={() => setSelectedIds(new Set())}
      />
      <AddClientDrawer open={addClientOpen} onOpenChange={setAddClientOpen} />
    </div>
  );
}

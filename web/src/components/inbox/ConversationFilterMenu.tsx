import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ClientListFilter, type GetConversationFilterCountsResponse } from '@/api/generated';

/**
 * The nine wireframe filter rows in wireframe order (docs/design/1095/
 * inbox-inventory.md) — six live (backed by `ClientListFilter` + the
 * filter-counts endpoint), three permanently disabled with no backend
 * domain to back them.
 */
const LIVE_FILTER_ORDER: ClientListFilter[] = [
  ClientListFilter.All,
  ClientListFilter.UnreadMessages,
  ClientListFilter.NoMessages,
  ClientListFilter.NewCheckIns,
  ClientListFilter.MissingCheckIns,
  ClientListFilter.EndingSoon,
];

const FILTER_LABEL_KEY: Record<ClientListFilter, string> = {
  [ClientListFilter.All]: 'inbox.filters.all',
  [ClientListFilter.UnreadMessages]: 'inbox.filters.unreadMessages',
  [ClientListFilter.NoMessages]: 'inbox.filters.noMessages',
  [ClientListFilter.NewCheckIns]: 'inbox.filters.newCheckIns',
  [ClientListFilter.MissingCheckIns]: 'inbox.filters.missingCheckIns',
  [ClientListFilter.EndingSoon]: 'inbox.filters.endingSoon',
};

const FILTER_COUNT_KEY: Record<ClientListFilter, keyof GetConversationFilterCountsResponse> = {
  [ClientListFilter.All]: 'all',
  [ClientListFilter.UnreadMessages]: 'unreadMessages',
  [ClientListFilter.NoMessages]: 'noMessages',
  [ClientListFilter.NewCheckIns]: 'newCheckIns',
  [ClientListFilter.MissingCheckIns]: 'missingCheckIns',
  [ClientListFilter.EndingSoon]: 'endingSoon',
};

/** Disabled rows, positioned per the wireframe: after "All", after "New check-ins", and last. */
const DISABLED_ROWS = [
  { key: 'failedPayments', afterFilter: ClientListFilter.All },
  { key: 'blockedAutomations', afterFilter: ClientListFilter.NewCheckIns },
] as const;

interface Props {
  active: ClientListFilter;
  counts?: GetConversationFilterCountsResponse;
  onSelect: (filter: ClientListFilter) => void;
}

/**
 * The "All (2)" filter dropdown beneath the search box (screens 1-2 of the
 * design inventory). Six live rows carry a real count and select the
 * corresponding `ClientListFilter`; three (Failed payments, Blocked
 * automations, Tasks overdue) render disabled with the shell's
 * coming-soon treatment — no such domain exists yet.
 */
export default function ConversationFilterMenu({ active, counts, onSelect }: Props) {
  const { t } = useTranslation();

  const activeCount = counts?.[FILTER_COUNT_KEY[active]] ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <span>
            {t(FILTER_LABEL_KEY[active])} ({activeCount})
          </span>
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" aria-label={t('inbox.filters.groupLabel')}>
        {LIVE_FILTER_ORDER.map((filter) => {
          const isActive = filter === active;
          const count = counts?.[FILTER_COUNT_KEY[filter]] ?? 0;
          const disabledRowAfter = DISABLED_ROWS.filter((row) => row.afterFilter === filter);

          return (
            <div key={filter}>
              <DropdownMenuItem
                onSelect={() => onSelect(filter)}
                className={cn('flex items-center justify-between gap-2', isActive && 'bg-accent text-accent-foreground')}
              >
                <span>
                  {t(FILTER_LABEL_KEY[filter])} ({count})
                </span>
                {isActive && <Check className="size-4" aria-hidden="true" />}
              </DropdownMenuItem>
              {disabledRowAfter.map((row) => (
                <DropdownMenuItem
                  key={row.key}
                  disabled
                  title={t('shell.comingSoon')}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{t(`inbox.filters.${row.key}`)} (0)</span>
                </DropdownMenuItem>
              ))}
            </div>
          );
        })}
        <DropdownMenuItem disabled title={t('shell.comingSoon')} className="flex items-center justify-between gap-2">
          <span>{t('inbox.filters.tasksOverdue')} (0)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

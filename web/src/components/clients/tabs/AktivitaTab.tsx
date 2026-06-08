import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { getClientTimeline } from '@/api/timeline';
import { DayCard } from '@/components/domain/RecentActivity/DayCard';
import {
  useRecentActivityAggregates,
  dayGroupMatchesFilter,
  type FilterType,
} from '@/components/domain/RecentActivity/useRecentActivityAggregates';

/** Maximum items the timeline endpoint returns. Disables "Zobrazit více" at this cap. */
const LIMIT_MAX = 100;

/** Initial number of timeline items to load. */
const LIMIT_INITIAL = 30;

/** Increment per "Zobrazit více" click. */
const LIMIT_INCREMENT = 30;

interface FilterChipDef {
  id: FilterType;
  label: string;
}

/** Returns a YYYY-MM string for the current calendar month. */
function currentMonthKey(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${m}`;
}

/** Format a YYYY-MM key into a localised "Month Year" string using Intl. */
function formatMonthLabel(monthKey: string, locale: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

interface AktivitaTabProps {
  clientId: string;
}

export function AktivitaTab({ clientId }: AktivitaTabProps) {
  const { t, i18n } = useTranslation();
  const monthSelectId = useId();

  const [limit, setLimit] = useState(LIMIT_INITIAL);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(currentMonthKey);

  const { data, isPending, isError } = useQuery({
    queryKey: ['client-timeline', clientId, limit],
    queryFn: () => getClientTimeline(clientId, limit),
    enabled: Boolean(clientId),
    retry: false,
  });

  const items = data?.items ?? [];

  const aggregates = useRecentActivityAggregates(items);

  const filterChips: FilterChipDef[] = [
    { id: 'all', label: t('clients.recentActivity.filterAll') },
    { id: 'pr', label: t('clients.recentActivity.filterPr') },
    { id: 'workout', label: t('clients.recentActivity.filterWorkout') },
    { id: 'measurement', label: t('clients.recentActivity.filterMeasurement') },
    { id: 'meal', label: t('clients.recentActivity.filterMeal') },
  ];

  /**
   * Unique YYYY-MM values present in the loaded items, sorted newest-first.
   * Always includes the current month so the picker has a default even when
   * no items have loaded for this month yet.
   */
  const availableMonths = useMemo<string[]>(() => {
    const monthSet = new Set<string>();
    for (const item of items) {
      monthSet.add(item.occurredAt.substring(0, 7));
    }
    monthSet.add(currentMonthKey());
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  }, [items]);

  // Durable state normalisation — "adjust state during render" idiom (React docs).
  // When availableMonths changes and selectedMonthKey is no longer present, reset
  // to the most recent month. React discards the in-progress render and immediately
  // re-renders with the corrected state — no intermediate commit, no visual flash.
  const [prevAvailableMonths, setPrevAvailableMonths] = useState(availableMonths);
  if (availableMonths !== prevAvailableMonths) {
    setPrevAvailableMonths(availableMonths);
    if (!availableMonths.includes(selectedMonthKey)) {
      setSelectedMonthKey(availableMonths[0] ?? currentMonthKey());
    }
  }

  // Render-path safety: ensure the select value always matches an available option.
  const effectiveMonthKey = availableMonths.includes(selectedMonthKey)
    ? selectedMonthKey
    : (availableMonths[0] ?? currentMonthKey());

  const filteredGroups = useMemo(
    () =>
      aggregates.dayGroups
        .filter((g) => dayGroupMatchesFilter(g, activeFilter))
        .filter((g) => g.dateKey.startsWith(effectiveMonthKey)),
    [aggregates.dayGroups, activeFilter, effectiveMonthKey],
  );

  const canLoadMore = limit < LIMIT_MAX && items.length >= limit;
  const isEmpty = !isPending && !isError && items.length === 0;
  const isFilterEmpty = !isPending && !isError && items.length > 0 && filteredGroups.length === 0;

  // Locale string for Intl month formatter
  const locale = (i18n.language as 'cs' | 'en' | 'de') ?? 'cs';

  return (
    <div id="cl-pane-aktivita">
      {/* Loading state */}
      {isPending && (
        <div className="py-12 text-center text-[13px] text-text3">
          {t('common.loading')}
        </div>
      )}

      {/* Error state — mirrors MereniTab pattern */}
      {isError && !isPending && (
        <div className="py-12 text-center text-[13px] text-text3">
          {t('clients.recentActivity.errorLoading')}
        </div>
      )}

      {/* Content — filter bar, cards, footer */}
      {!isPending && !isError && (
        <>
          {/* Filter chip bar */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveFilter(chip.id)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-border-md bg-bg text-text2 cursor-pointer transition-colors hover:bg-bg-hover',
                  chip.id === activeFilter &&
                    'bg-accent-bg text-accent font-medium border-accent-br',
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Empty state — no items at all */}
          {isEmpty && (
            <div className="py-12 text-center">
              <p className="text-[13px] text-text3 mb-2">
                {t('clients.recentActivity.empty')}
              </p>
            </div>
          )}

          {/* Filter/month yields no matches — show message + reset CTA */}
          {isFilterEmpty && (
            <div className="py-8 text-center">
              <p className="text-[13px] text-text3 mb-2">
                {t('clients.recentActivity.noEventsForFilter')}
              </p>
              {activeFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className="text-[13px] font-medium text-accent hover:underline bg-transparent border-none cursor-pointer"
                >
                  {t('clients.recentActivity.resetFilter')}
                </button>
              )}
            </div>
          )}

          {/* Day cards — reverse-chronological */}
          {filteredGroups.length > 0 && (
            <div className="mb-3">
              {filteredGroups.map((group, idx) => (
                <DayCard
                  key={group.dateKey}
                  group={group}
                  filter={activeFilter}
                  defaultExpanded={idx === 0}
                />
              ))}
            </div>
          )}

          {/* Footer: Zobrazit více + month picker — only when items loaded */}
          {!isEmpty && (
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <button
                type="button"
                disabled={!canLoadMore}
                onClick={
                  canLoadMore
                    ? () => setLimit((prev) => Math.min(prev + LIMIT_INCREMENT, LIMIT_MAX))
                    : undefined
                }
                className={cn(
                  'px-3 py-1.5 text-[13px] rounded-md border border-border-md text-text2 transition-colors',
                  canLoadMore
                    ? 'hover:bg-bg-hover cursor-pointer'
                    : 'opacity-40 cursor-not-allowed',
                )}
              >
                {t('clients.recentActivity.loadMore')}
              </button>

              {/* Month picker chip */}
              <div className="flex items-center gap-1 relative">
                <label htmlFor={monthSelectId} className="text-[13px] text-text2">
                  {t('clients.recentActivity.monthPickerPrefix')}
                </label>
                <div className="relative inline-flex items-center">
                  <select
                    id={monthSelectId}
                    value={effectiveMonthKey}
                    onChange={(e) => setSelectedMonthKey(e.target.value)}
                    className={cn(
                      'appearance-none pl-2 pr-6 py-1 text-[13px] rounded-md',
                      'border border-border-md bg-accent-bg text-accent font-medium',
                      'cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent',
                    )}
                  >
                    {availableMonths.map((mk) => (
                      <option key={mk} value={mk}>
                        {formatMonthLabel(mk, locale)}
                      </option>
                    ))}
                  </select>
                  {/* Decorative caret */}
                  <span aria-hidden="true" className="pointer-events-none absolute right-1.5 text-accent text-[10px]">
                    ▾
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

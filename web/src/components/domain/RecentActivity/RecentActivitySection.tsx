import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { ClientTimelineItem } from '@/api/timeline';
import { DayCard } from './DayCard';
import { SummarySidebar } from './SummarySidebar';
import {
  useRecentActivityAggregates,
  dayGroupMatchesFilter,
  type FilterType,
} from './useRecentActivityAggregates';

/** Maximum items the backend will return. Disables "Zobrazit více" at this cap. */
const LIMIT_MAX = 100;

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
  // Day=1 is fine — we only use month+year from the formatter
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

interface RecentActivitySectionProps {
  items: ClientTimelineItem[];
  /**
   * The current limit in use for this timeline query.
   * The section renders a "Zobrazit více" button that calls onLoadMore
   * unless limit === LIMIT_MAX or items.length < limit (already at end).
   */
  limit: number;
  onLoadMore: () => void;
  locale: 'cs' | 'en' | 'de';
}

export function RecentActivitySection({
  items,
  limit,
  onLoadMore,
  locale,
}: RecentActivitySectionProps) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(currentMonthKey);

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
   * Used to populate the month picker <select>.
   */
  const availableMonths = useMemo<string[]>(() => {
    const monthSet = new Set<string>();
    for (const item of items) {
      monthSet.add(item.occurredAt.substring(0, 7)); // "YYYY-MM"
    }
    // Also always include current month so the picker has a default even when
    // no items have loaded for this month yet.
    monthSet.add(currentMonthKey());
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  }, [items]);

  // Durable state normalisation — "adjust state during render" idiom (React docs).
  // When availableMonths changes and selectedMonthKey is no longer present, we
  // call setSelectedMonthKey synchronously in the render body. React detects the
  // setState call, discards the in-progress render, and immediately re-renders
  // with the corrected state — no intermediate commit, no visual flash.
  //
  // WHY NOT useEffect: ESLint's react-hooks/set-state-in-effect rule rejects
  // useEffect(() => setState(...)) as the "you might not need an effect"
  // anti-pattern, and correctly so — the reset is a pure derivation of prop
  // changes, not a side effect.
  //
  // Sibling state tracks the previous availableMonths reference so we can
  // detect when the prop identity changes between renders.
  const [prevAvailableMonths, setPrevAvailableMonths] = useState(availableMonths);
  if (availableMonths !== prevAvailableMonths) {
    setPrevAvailableMonths(availableMonths);
    if (!availableMonths.includes(selectedMonthKey)) {
      setSelectedMonthKey(availableMonths[0] ?? currentMonthKey());
    }
  }

  // Synchronous render-path safety net: even on the very first render after
  // availableMonths changes (before the adjust-during-render setState above has
  // been processed), this ternary ensures <select value={...}> never holds a
  // value that is absent from its <option> children. Do NOT remove this — it
  // prevents a React controlled-component value mismatch warning on that
  // first render pass.
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

  // "Zobrazit více" is disabled when we're at the cap or there's nothing more to load
  const canLoadMore = limit < LIMIT_MAX && items.length >= limit;

  const isEmpty = items.length === 0;

  return (
    <div>
      {/* Section header: title + filter chips */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h2 className="text-[22px] font-semibold tracking-tight text-text">
          {t('clients.recentActivity.title')}
        </h2>
        {/* Filter chips — right-aligned */}
        <div className="flex gap-1.5 ml-auto flex-wrap">
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
      </div>

      {isEmpty ? (
        /* Empty state — preserve original copy */
        <p className="text-[13px] text-text3">{t('clients.recentActivity.empty')}</p>
      ) : (
        /*
         * Two-column layout: timeline takes remaining space, sidebar is fixed ~280 px.
         * The AC requires exactly 900 px as the stacking breakpoint.
         * Tailwind 4 supports arbitrary breakpoints via min-[900px]: / max-[899px]:.
         * Below 900 px the sidebar stacks below the timeline.
         */
        <div
          className="flex flex-col min-[900px]:grid min-[900px]:gap-5 gap-4"
          style={{ gridTemplateColumns: '1fr 280px' }}
        >
          {/* LEFT: day-grouped timeline */}
          <div className="min-w-0">
            {filteredGroups.length === 0 ? (
              <p className="text-[13px] text-text3 mb-3">
                {t('clients.recentActivity.noEventsForFilter')}
              </p>
            ) : (
              filteredGroups.map((group, idx) => (
                <DayCard
                  key={group.dateKey}
                  group={group}
                  filter={activeFilter}
                  defaultExpanded={idx === 0}
                />
              ))
            )}

            {/* Footer: Zobrazit více + month picker */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button
                type="button"
                disabled={!canLoadMore}
                onClick={canLoadMore ? onLoadMore : undefined}
                className={cn(
                  'px-3 py-1.5 text-[13px] rounded-md border border-border-md text-text2 transition-colors',
                  canLoadMore
                    ? 'hover:bg-bg-hover cursor-pointer'
                    : 'opacity-40 cursor-not-allowed',
                )}
              >
                {t('clients.recentActivity.loadMore')}
              </button>

              {/* Month picker chip — client-side filter */}
              <div className="flex items-center gap-1 relative">
                <span className="text-[13px] text-text2">
                  {t('clients.recentActivity.monthPickerPrefix')}
                </span>
                <div className="relative inline-flex items-center">
                  <select
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
                  {/* Caret overlay — purely decorative */}
                  <span aria-hidden="true" className="pointer-events-none absolute right-1.5 text-accent text-[10px]">
                    ▾
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: summary sidebar — stacks below timeline on narrow viewports */}
          <div>
            <SummarySidebar
              thisMonth={aggregates.thisMonth}
              topPr={aggregates.topPr}
              thisWeek={aggregates.thisWeek}
              locale={locale}
            />
          </div>
        </div>
      )}
    </div>
  );
}

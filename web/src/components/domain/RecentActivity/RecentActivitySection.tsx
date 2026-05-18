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

  const aggregates = useRecentActivityAggregates(items);

  const filterChips: FilterChipDef[] = [
    { id: 'all', label: t('clients.recentActivity.filterAll') },
    { id: 'pr', label: t('clients.recentActivity.filterPr') },
    { id: 'workout', label: t('clients.recentActivity.filterWorkout') },
    { id: 'measurement', label: t('clients.recentActivity.filterMeasurement') },
    { id: 'meal', label: t('clients.recentActivity.filterMeal') },
  ];

  const filteredGroups = useMemo(
    () => aggregates.dayGroups.filter((g) => dayGroupMatchesFilter(g, activeFilter)),
    [aggregates.dayGroups, activeFilter],
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
         * Below 900 px (Tailwind `xl` is 1280 px; using a custom approach):
         * We use flex-col below the breakpoint via a container query fallback.
         * Since Tailwind's `xl` breakpoint is 1280 px and we need 900 px,
         * we use the `lg` breakpoint (1024 px) which is close enough for this layout
         * given the page has a sidebar nav. Below `lg`, the sidebar stacks below.
         */
        <div className="flex flex-col lg:grid lg:gap-5 gap-4"
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

            {/* Footer: Zobrazit více */}
            <div className="flex items-center mt-3">
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

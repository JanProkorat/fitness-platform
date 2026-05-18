import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Tag } from '@/components/ui';
import type { DayGroup, FilterType } from './useRecentActivityAggregates';

interface DayCardProps {
  group: DayGroup;
  filter: FilterType;
  defaultExpanded?: boolean;
}

function eventDotColor(type: DayGroup['events'][number]['type']): string {
  if (type === 'personal_record') return 'bg-accent';
  if (type === 'workout') return 'bg-blue';
  if (type === 'measurement') return 'bg-purple';
  if (type === 'meal_day') return 'bg-green';
  return 'bg-text3';
}

export function DayCard({ group, filter, defaultExpanded = false }: DayCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Filter events based on current filter
  const visibleEvents =
    filter === 'all'
      ? group.events
      : group.events.filter((ev) => {
          if (filter === 'pr') return ev.type === 'personal_record';
          if (filter === 'workout') return ev.type === 'workout';
          if (filter === 'measurement') return ev.type === 'measurement';
          if (filter === 'meal') return ev.type === 'meal_day';
          return true;
        });

  const hasPr = group.prCount > 0;
  const hasWorkout = group.workoutCount > 0;

  // Summary chips (always from the full group, not filtered)
  const summaryChips: React.ReactNode[] = [];
  if (hasPr) {
    summaryChips.push(
      <Tag key="pr" variant="accent">
        {t('clients.recentActivity.prCount', { count: group.prCount })}
      </Tag>,
    );
  }
  if (hasWorkout) {
    summaryChips.push(
      <Tag key="workout" variant="blue">
        {t('clients.recentActivity.workoutCount', { count: group.workoutCount })}
      </Tag>,
    );
  }
  if (group.measurementCount > 0) {
    summaryChips.push(
      <Tag key="meas" variant="purple">
        {t('clients.recentActivity.measurementCount', { count: group.measurementCount })}
      </Tag>,
    );
  }
  if (group.mealCount > 0) {
    summaryChips.push(
      <Tag key="meal" variant="green">
        {t('clients.recentActivity.mealCount', { count: group.mealCount })}
      </Tag>,
    );
  }

  return (
    <div className="border border-border rounded-md mb-2 overflow-hidden">
      {/* Header row — always visible, acts as toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-3.5 py-2.5 text-left cursor-pointer transition-colors hover:bg-bg-hover',
          expanded && 'bg-bg-hover border-b border-border',
        )}
        aria-expanded={expanded}
      >
        <span className="text-[13px] font-semibold min-w-[96px] text-text">
          {group.dateLabel}
        </span>
        <span className="flex-1 flex gap-1.5 flex-wrap">{summaryChips}</span>
        <span
          className="text-[11px] text-text3 ml-1"
          aria-hidden="true"
        >
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {/* Expanded event list */}
      {expanded && (
        <div className="px-3.5 pb-2.5 pt-1">
          {visibleEvents.map((ev, idx) => (
            <div
              key={ev.id}
              className={cn(
                'flex items-center gap-2.5 py-1.5 text-[13px]',
                idx < visibleEvents.length - 1 && 'border-b border-border',
              )}
            >
              {/* type dot */}
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  eventDotColor(ev.type),
                )}
              />
              {/* title */}
              <span className="flex-1 text-text">
                {ev.icon && <span className="mr-1">{ev.icon}</span>}
                {ev.title}
              </span>
              {/* description (reps / count) shown right-aligned */}
              {ev.description && (
                <span className="text-text3 text-xs ml-auto whitespace-nowrap">
                  {ev.description}
                </span>
              )}
            </div>
          ))}
          {visibleEvents.length === 0 && (
            <div className="py-2 text-[13px] text-text3">
              {t('clients.recentActivity.noEventsForFilter')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

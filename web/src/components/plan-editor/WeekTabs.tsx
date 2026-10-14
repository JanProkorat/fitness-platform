import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAX_WEEKS, type WeekPillStatus } from '@/components/plan-editor/plan-editor-types';

const SCROLL_STEP_PX = 240;
const DOT_CLASS = 'size-1.75 shrink-0 rounded-full';

const DOT_STATUS_CLASS: Record<WeekPillStatus, string> = {
  published: 'bg-nutrition',
  draft: 'border-[1.5px] border-training',
  empty: 'border-[1.5px] border-dashed border-faint',
};

/** Published is a solid dot, draft a ring, empty a dashed ring; the same in the legend and on the pills. */
function StatusDot({ status, className }: { status: WeekPillStatus; className?: string }) {
  return <span aria-hidden="true" className={cn(DOT_CLASS, DOT_STATUS_CLASS[status], className)} />;
}

interface Props {
  weekCount: number;
  current: number;
  readOnly: boolean;
  /** Publication state per week; omit for no dots and no legend. Return undefined for a week with no status. */
  weekStatus?: (weekIndex: number) => WeekPillStatus | undefined;
  onSelect: (weekIndex: number) => void;
  onAddWeek: () => void;
}

/** Scrollable row of week pills with prev/next arrows and an add-week button. */
export default function WeekTabs({ weekCount, current, readOnly, weekStatus, onSelect, onAddWeek }: Props) {
  const { t } = useTranslation();
  const statuses = weekStatus ? Array.from({ length: weekCount }, (_, index) => weekStatus(index)) : [];
  const published = statuses.filter((status) => status === 'published').length;
  const draft = statuses.filter((status) => status === 'draft').length;
  const empty = statuses.filter((status) => status === 'empty').length;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  function scrollBy(direction: -1 | 1) {
    listRef.current?.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: 'smooth' });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="shrink-0 rounded-full"
        aria-label={t('planEditor.weeks.previous')}
        onClick={() => scrollBy(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <div
        ref={listRef}
        role="tablist"
        aria-label={t('planEditor.weeks.label')}
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]"
      >
        {Array.from({ length: weekCount }, (_, index) => {
          const status = statuses[index];
          return (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === current}
              onClick={() => onSelect(index)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                'h-7',
                index === current
                  ? 'border-ink bg-ink text-primary-foreground'
                  : 'border-line bg-card text-ink hover:bg-muted',
              )}
            >
              {status && <StatusDot status={status} />}
              {t('planEditor.weeks.week', { number: index + 1 })}
              {status && <span className="sr-only">{t(`planEditor.weeks.status_${status}`)}</span>}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="shrink-0 rounded-full"
        aria-label={t('planEditor.weeks.next')}
        onClick={() => scrollBy(1)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="shrink-0 rounded-full border-dashed"
          aria-label={t('planEditor.weeks.add')}
          disabled={weekCount >= MAX_WEEKS}
          onClick={onAddWeek}
        >
          <Plus aria-hidden="true" />
        </Button>
      )}
      {weekStatus && weekCount > 0 && (
        <div className="flex shrink-0 items-center gap-3 text-meta whitespace-nowrap text-muted-foreground">
          {empty > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status="empty" />
              {t('planEditor.weeks.legendEmpty', { count: empty })}
            </span>
          )}
          {published > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status="published" />
              {t('planEditor.weeks.legendPublished', { count: published })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {empty > 0 && <span aria-hidden="true">·</span>}
              {t('planEditor.weeks.legendNothingPublished')}
            </span>
          )}
          {draft > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status="draft" />
              {t('planEditor.weeks.legendDraft', { count: draft })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

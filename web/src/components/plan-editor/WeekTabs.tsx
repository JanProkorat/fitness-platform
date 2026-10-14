import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAX_WEEKS, type WeekStatus } from '@/components/plan-editor/plan-editor-types';

const SCROLL_STEP_PX = 240;
const DOT_CLASS = 'size-1.75 shrink-0 rounded-full';

/** Published is a solid dot, draft a ring; the colours are the same in the legend and on the pills. */
function StatusDot({ status, className }: { status: WeekStatus; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        DOT_CLASS,
        status === 'published' ? 'bg-nutrition' : 'border-[1.5px] border-training',
        className,
      )}
    />
  );
}

interface Props {
  weekCount: number;
  current: number;
  readOnly: boolean;
  /** Publication state per week; omit for no dots and no legend. Return undefined for a week with no status. */
  weekStatus?: (weekIndex: number) => WeekStatus | undefined;
  onSelect: (weekIndex: number) => void;
  onAddWeek: () => void;
}

/** Scrollable row of week pills with prev/next arrows and an add-week button. */
export default function WeekTabs({ weekCount, current, readOnly, weekStatus, onSelect, onAddWeek }: Props) {
  const { t } = useTranslation();
  const statuses = weekStatus ? Array.from({ length: weekCount }, (_, index) => weekStatus(index)) : [];
  const published = statuses.filter((status) => status === 'published').length;
  const draft = statuses.filter((status) => status === 'draft').length;
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
              {t('planEditor.weeks.week', { number: index + 1 })}
              {status && (
                <>
                  <StatusDot status={status} />
                  <span className="sr-only">{t(`planEditor.weeks.status_${status}`)}</span>
                </>
              )}
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
      {weekStatus && (published > 0 || draft > 0) && (
        <div className="flex shrink-0 items-center gap-3 text-meta text-muted-foreground">
          {published > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status="published" />
              {t('planEditor.weeks.legendPublished', { count: published })}
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

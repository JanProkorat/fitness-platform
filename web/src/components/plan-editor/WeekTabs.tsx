import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAX_WEEKS } from '@/components/plan-editor/plan-editor-types';

const SCROLL_STEP_PX = 240;

interface Props {
  weekCount: number;
  current: number;
  readOnly: boolean;
  onSelect: (weekIndex: number) => void;
  onAddWeek: () => void;
}

/** Scrollable row of week pills with prev/next arrows and an add-week button. */
export default function WeekTabs({ weekCount, current, readOnly, onSelect, onAddWeek }: Props) {
  const { t } = useTranslation();
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
        {Array.from({ length: weekCount }, (_, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={index === current}
            onClick={() => onSelect(index)}
            className={cn(
              'inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              index === current
                ? 'border-ink bg-ink text-primary-foreground'
                : 'border-line bg-card text-ink hover:bg-muted',
            )}
          >
            {t('planEditor.weeks.week', { number: index + 1 })}
          </button>
        ))}
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
      <span className="ml-auto shrink-0 pl-2 text-body text-muted-foreground">
        {t('planEditor.weeks.position', { current: current + 1, total: weekCount })}
      </span>
    </div>
  );
}

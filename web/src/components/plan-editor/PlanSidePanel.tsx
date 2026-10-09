import { useId, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SIDE_TAB_ICON, SIDE_TABS } from '@/components/plan-editor/plan-editor-side-tabs';
import type { EditorSideTab } from '@/components/plan-editor/plan-editor-types';

interface Props {
  tab: EditorSideTab;
  onTabChange: (tab: EditorSideTab) => void;
  /** Collapsed panels slide out and become inert (no tab stops, hidden from assistive tech). */
  open: boolean;
  onCollapse: () => void;
  collapseRef?: Ref<HTMLButtonElement>;
  info: ReactNode;
  library: ReactNode;
}

/** Left panel: Template info and Library as header tabs, with the collapse button at the right end. */
export default function PlanSidePanel({ tab, onTabChange, open, onCollapse, collapseRef, info, library }: Props) {
  const { t } = useTranslation();
  const baseId = useId();
  const labels: Record<EditorSideTab, string> = {
    info: t('planEditor.info.tab'),
    library: t('planEditor.library.title'),
  };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    const next = SIDE_TABS[(SIDE_TABS.indexOf(tab) + 1) % SIDE_TABS.length] ?? tab;
    onTabChange(next);
    document.getElementById(`${baseId}-${next}-tab`)?.focus();
  }

  return (
    <aside
      aria-label={labels[tab]}
      inert={!open}
      className={cn(
        'flex h-full w-80 shrink-0 flex-col overflow-hidden border-r-2 border-line bg-sunken transition-transform duration-300 ease-out motion-reduce:transition-none',
        !open && '-translate-x-full',
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-4.5">
        <div
          role="tablist"
          aria-label={t('planEditor.panel.tabs')}
          onKeyDown={onKeyDown}
          className="flex items-center gap-4"
        >
          {SIDE_TABS.map((value) => {
            const selected = tab === value;
            const Icon = SIDE_TAB_ICON[value];
            return (
              <button
                key={value}
                id={`${baseId}-${value}-tab`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-${value}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onTabChange(value)}
                className={cn(
                  'flex h-7.5 cursor-pointer items-center gap-1.75 border-b-2 text-label font-bold tracking-label whitespace-nowrap uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  selected ? 'border-ink text-ink' : 'border-transparent text-muted-foreground hover:text-ink',
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                {labels[value]}
              </button>
            );
          })}
        </div>
        <Button
          ref={collapseRef}
          type="button"
          variant="outline"
          size="icon"
          className="ml-auto size-7.5"
          aria-label={t('planEditor.library.collapse')}
          title={t('planEditor.library.collapse')}
          onClick={onCollapse}
        >
          <PanelLeftClose aria-hidden="true" />
        </Button>
      </div>
      {SIDE_TABS.map((value) => (
        <div
          key={value}
          id={`${baseId}-${value}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-${value}-tab`}
          hidden={tab !== value}
          className="flex min-h-0 flex-1 flex-col"
        >
          {value === 'info' ? info : library}
        </div>
      ))}
    </aside>
  );
}

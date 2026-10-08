import { useId, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EditorSideTab } from '@/components/plan-editor/plan-editor-types';

const TABS: readonly EditorSideTab[] = ['info', 'library'];

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

/** Left panel: the Template info and Library tabs, switched with a vertical rail on the right edge. */
export default function PlanSidePanel({ tab, onTabChange, open, onCollapse, collapseRef, info, library }: Props) {
  const { t } = useTranslation();
  const baseId = useId();
  const labels: Record<EditorSideTab, string> = {
    info: t('planEditor.info.tab'),
    library: t('planEditor.library.title'),
  };

  return (
    <aside
      aria-label={labels[tab]}
      inert={!open}
      className={cn(
        'flex h-full w-90 shrink-0 overflow-hidden border-r-2 border-line bg-sunken transition-transform duration-300 ease-out motion-reduce:transition-none',
        !open && '-translate-x-full',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {TABS.map((value) => (
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
      </div>
      <div className="flex w-10 shrink-0 flex-col items-center gap-3 border-l border-line py-3">
        <Button
          ref={collapseRef}
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t('planEditor.library.collapse')}
          title={t('planEditor.library.collapse')}
          onClick={onCollapse}
        >
          <PanelLeftClose aria-hidden="true" />
        </Button>
        <div role="tablist" aria-orientation="vertical" aria-label={t('planEditor.panel.tabs')} className="flex flex-col gap-2">
          {TABS.map((value) => {
            const selected = tab === value;
            return (
              <button
                key={value}
                id={`${baseId}-${value}-tab`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-${value}-panel`}
                onClick={() => onTabChange(value)}
                className={cn(
                  'cursor-pointer rounded-lg border px-1.5 py-3 text-label font-bold tracking-label whitespace-nowrap uppercase outline-none transition-colors [writing-mode:vertical-rl] rotate-180 focus-visible:ring-3 focus-visible:ring-ring/50',
                  selected
                    ? 'border-line bg-card text-ink shadow-panel'
                    : 'border-transparent text-muted-foreground hover:text-ink',
                )}
              >
                {labels[value]}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

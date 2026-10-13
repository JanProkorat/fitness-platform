import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EditorSideTabDef<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
}

export interface EditorSidePanelLabels {
  /** Accessible name of the tab list. */
  tabs: string;
  collapse: string;
  expand: string;
  /** Accessible name of a collapsed-strip tab button. */
  openTab: (name: string) => string;
}

interface Props<T extends string> {
  tabs: readonly EditorSideTabDef<T>[];
  tab: T;
  onTabChange: (tab: T) => void;
  /** Collapsed panels slide out and become inert (no tab stops, hidden from assistive tech). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: EditorSidePanelLabels;
  /** Extra data attributes for the width-animated container (hooks for outside-click checks). */
  containerAttributes?: Record<`data-${string}`, string | true>;
}

/**
 * Closable left panel for editors: tabs in the header, a collapse button, and a collapsed strip with
 * one button per tab. Owns the open/close width animation and hands keyboard focus to the visible toggle.
 */
export default function EditorSidePanel<T extends string>({
  tabs,
  tab,
  onTabChange,
  open,
  onOpenChange,
  labels,
  containerAttributes,
}: Props<T>) {
  const baseId = useId();
  const expandRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const toggled = useRef(false);
  const current = tabs.find((candidate) => candidate.id === tab);

  // Keep keyboard focus on the visible toggle: the collapse button goes inert, the expand button unmounts.
  useEffect(() => {
    if (!toggled.current) {
      return;
    }
    (open ? collapseRef : expandRef).current?.focus({ preventScroll: true });
  }, [open]);

  function toggle(next: boolean) {
    toggled.current = true;
    onOpenChange(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    const index = tabs.findIndex((candidate) => candidate.id === tab);
    const next = tabs[(index + 1) % tabs.length]?.id ?? tab;
    onTabChange(next);
    document.getElementById(`${baseId}-${next}-tab`)?.focus();
  }

  return (
    <div
      {...containerAttributes}
      className={cn(
        'relative shrink-0 overflow-hidden transition-[width] duration-300 ease-out motion-reduce:transition-none',
        open ? 'w-80' : 'w-13',
      )}
    >
      <aside
        aria-label={current?.label}
        inert={!open}
        className={cn(
          'flex h-full w-80 shrink-0 flex-col overflow-hidden border-r-2 border-line bg-sunken transition-transform duration-300 ease-out motion-reduce:transition-none',
          !open && '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2 px-4 pt-4.5">
          <div role="tablist" aria-label={labels.tabs} onKeyDown={onKeyDown} className="flex items-center gap-4">
            {tabs.map(({ id, label, icon: Icon }) => {
              const selected = tab === id;
              return (
                <button
                  key={id}
                  id={`${baseId}-${id}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${baseId}-${id}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onTabChange(id)}
                  className={cn(
                    'flex h-7.5 cursor-pointer items-center gap-1.75 border-b-2 text-label font-bold tracking-label whitespace-nowrap uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    selected ? 'border-ink text-ink' : 'border-transparent text-muted-foreground hover:text-ink',
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  {label}
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
            aria-label={labels.collapse}
            title={labels.collapse}
            onClick={() => toggle(false)}
          >
            <PanelLeftClose aria-hidden="true" />
          </Button>
        </div>
        {tabs.map(({ id, content }) => (
          <div
            key={id}
            id={`${baseId}-${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-${id}-tab`}
            hidden={tab !== id}
            className="flex min-h-0 flex-1 flex-col"
          >
            {content}
          </div>
        ))}
      </aside>
      <div
        data-testid="side-panel-strip"
        inert={open}
        className={cn(
          'absolute inset-y-0 left-0 z-10 flex w-13 flex-col items-center gap-3.5 border-r-2 border-line bg-sunken py-4 shadow-panel transition-opacity duration-150 motion-reduce:transition-none',
          open ? 'opacity-0' : 'opacity-100 delay-150 motion-reduce:delay-0',
        )}
      >
        <button
          ref={expandRef}
          type="button"
          aria-label={labels.expand}
          title={labels.expand}
          onClick={() => toggle(true)}
          className="flex size-9 cursor-pointer items-center justify-center rounded-field border border-line bg-card text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <PanelLeftOpen className="size-4" aria-hidden="true" />
        </button>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            data-testid={`side-strip-${id}`}
            aria-label={labels.openTab(label)}
            title={labels.openTab(label)}
            onClick={() => {
              onTabChange(id);
              toggle(true);
            }}
            className="flex w-9 cursor-pointer flex-col items-center gap-2 rounded-field py-2 text-ink outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="text-label font-bold tracking-label whitespace-nowrap uppercase [writing-mode:vertical-rl] rotate-180">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

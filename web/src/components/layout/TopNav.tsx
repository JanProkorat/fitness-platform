import { cn } from '@/lib/cn';

export interface TopNavItem {
  label: string;
  href: string;
  active?: boolean;
  section?: string;
}

export interface TopNavProps {
  items: TopNavItem[];
  onToggleDark?: () => void;
}

export function TopNav({ items, onToggleDark }: TopNavProps) {
  // Group items by section
  const sections: { section: string | undefined; items: TopNavItem[] }[] = [];
  let currentSection: string | undefined;

  for (const item of items) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      sections.push({ section: currentSection, items: [item] });
    } else {
      sections[sections.length - 1].items.push(item);
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-[900] flex h-10 items-center gap-0.5 overflow-x-auto border-b border-border bg-bg px-3">
      {/* Logo */}
      <span className="mr-2.5 shrink-0 whitespace-nowrap text-xs font-semibold text-accent">
        GF Platform
      </span>

      {/* Nav sections */}
      {sections.map((group, gi) => (
        <div key={gi} className="contents">
          {/* Separator between sections */}
          {gi > 0 && (
            <div className="mx-2 h-4 w-px shrink-0 bg-border-md" />
          )}

          {/* Section label */}
          {group.section && (
            <span className="shrink-0 whitespace-nowrap px-1.5 text-[11px] tracking-[0.03em] text-text3">
              {group.section}
            </span>
          )}

          {/* Buttons */}
          {group.items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-sm px-2 py-1 text-xs transition-colors duration-100',
                item.active
                  ? 'bg-bg-active font-medium text-text'
                  : 'text-text2 hover:bg-bg-hover hover:text-text',
              )}
            >
              {item.label}
            </a>
          ))}
        </div>
      ))}

      {/* Right side */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {onToggleDark && (
          <button
            type="button"
            onClick={onToggleDark}
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-border-md text-[13px] text-text2 transition-colors duration-100 hover:bg-bg-hover hover:text-text"
            aria-label="Přepnout tmavý režim"
          >
            ◑
          </button>
        )}
      </div>
    </nav>
  );
}

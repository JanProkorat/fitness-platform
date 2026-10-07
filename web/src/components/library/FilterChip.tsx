import type { ComponentProps } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props extends Omit<ComponentProps<'button'>, 'children'> {
  label: string;
  /** Number of selected values; a positive count switches the chip to its active look. */
  count: number;
}

/** Filter pill for the library tables: dashed and idle, solid green with a count badge when active. */
export default function FilterChip({ label, count, className, ...props }: Props) {
  const active = count > 0;
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8.5 shrink-0 items-center gap-1.75 rounded-full border bg-background px-3.5 text-body font-medium whitespace-nowrap text-ink outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
        active ? 'border-nutrition' : 'border-dashed border-line hover:bg-muted',
        className,
      )}
      {...props}
    >
      <Plus className="size-3.5" aria-hidden="true" />
      {label}
      {active && (
        <span className="inline-flex h-5 min-w-badge-min items-center justify-center rounded-full bg-nutrition px-1.5 text-caption font-bold text-on-nutrition">
          {count}
        </span>
      )}
    </button>
  );
}

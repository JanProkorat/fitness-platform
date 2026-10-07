import { useState } from 'react';
import { Check } from 'lucide-react';
import FilterChip from '@/components/library/FilterChip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface SingleFilterOption<TValue extends string | number> {
  value: TValue;
  label: string;
}

interface Props<TValue extends string | number> {
  label: string;
  options: SingleFilterOption<TValue>[];
  selected: TValue | null;
  onChange: (value: TValue | null) => void;
}

/** Filter pill for a single-valued server filter: picking an option replaces the selection, picking it again clears it. */
export default function SingleOptionFilterPopover<TValue extends string | number>({
  label,
  options,
  selected,
  onChange,
}: Props<TValue>) {
  const [open, setOpen] = useState(false);

  function pick(value: TValue) {
    onChange(selected === value ? null : value);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterChip label={label} count={selected === null ? 0 : 1} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <ul className="flex max-h-72 flex-col overflow-y-auto" role="listbox" aria-label={label}>
          {options.map((option) => {
            const isSelected = option.value === selected;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => pick(option.value)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-body text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                    isSelected && 'font-semibold',
                  )}
                >
                  {option.label}
                  {isSelected && <Check className="size-4 text-nutrition" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

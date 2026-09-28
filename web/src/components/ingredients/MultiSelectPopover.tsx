import { ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface Props {
  placeholder: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  id?: string;
}

/**
 * Generic multi-select dropdown used by the ingredient drawer's "Dietary
 * Preferences" and "Contains Allergens" fields — a fixed, enum-backed option
 * list (see `docs/design/ingredients/inventory.md`'s maintainer decisions),
 * unlike the free-form tag input. Built on the same Popover + Checkbox
 * primitives as the filter-bar popovers
 * (`@/components/ingredients/IngredientTagFilterPopover.tsx`).
 */
export default function MultiSelectPopover({ placeholder, options, selected, onChange, id }: Props) {
  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const selectedLabels = options.filter((option) => selected.includes(option.value)).map((option) => option.label);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          className={cn(
            'flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-left text-body text-foreground shadow-none outline-none transition-[color,box-shadow]',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          )}
        >
          <span className={cn('truncate', selectedLabels.length === 0 && 'text-faint')}>
            {selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <ul className="flex max-h-64 flex-col gap-2.5 overflow-y-auto">
          {options.map((option) => (
            <li key={option.value}>
              <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                <Checkbox checked={selected.includes(option.value)} onCheckedChange={() => toggle(option.value)} />
                {option.label}
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

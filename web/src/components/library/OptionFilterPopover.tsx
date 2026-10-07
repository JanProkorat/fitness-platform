import FilterChip from '@/components/library/FilterChip';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface FilterOption<TValue extends string> {
  value: TValue;
  label: string;
}

interface Props<TValue extends string> {
  label: string;
  options: FilterOption<TValue>[];
  selected: TValue[];
  onChange: (values: TValue[]) => void;
}

/** Multi-select filter pill over a fixed, enum-backed option list. Same look as
 * the Owner and Category pills. Whether several selections AND or OR together
 * is decided by the backend, not here. */
export default function OptionFilterPopover<TValue extends string>({ label, options, selected, onChange }: Props<TValue>) {
  function toggle(value: TValue) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterChip label={label} count={selected.length} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56">
        <ul className="flex max-h-72 flex-col gap-2.5 overflow-y-auto">
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

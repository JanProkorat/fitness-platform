import { cn } from '@/lib/cn';

export interface FilterChip {
  id: string;
  label: string;
}

export interface FilterChipsProps {
  chips: FilterChip[];
  activeId: string;
  onChange: (id: string) => void;
}

export function FilterChips({ chips, activeId, onChange }: FilterChipsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-3">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange(chip.id)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-border-md bg-bg text-text2 cursor-pointer transition-colors hover:bg-bg-hover',
            chip.id === activeId && 'bg-bg-active text-text font-medium',
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

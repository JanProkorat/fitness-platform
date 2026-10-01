import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { FoodSortDirection } from '@/api/food-types';

interface SortIconProps {
  active: boolean;
  sortDir: FoodSortDirection;
}

function SortIcon({ active, sortDir }: SortIconProps) {
  if (!active) {
    return <ArrowUpDown className="size-3.5 text-muted-foreground/50" aria-hidden="true" />;
  }
  return sortDir === FoodSortDirection.Descending ? (
    <ArrowDown className="size-3.5" aria-hidden="true" />
  ) : (
    <ArrowUp className="size-3.5" aria-hidden="true" />
  );
}

interface Props<TField extends string> {
  field: TField;
  label: string;
  sortBy: TField | null;
  sortDir: FoodSortDirection;
  onSortChange: (field: TField) => void;
  sortButtonLabel: string;
}

/** Clickable table column header that cycles the column's sort state. Shared
 * by the Ingredients and Recipes tables. Declared at module scope so a table's
 * render never re-creates it (`react-hooks/static-components`). */
export default function SortableColumnHeader<TField extends string>({
  field,
  label,
  sortBy,
  sortDir,
  onSortChange,
  sortButtonLabel,
}: Props<TField>) {
  return (
    <button
      type="button"
      className="flex cursor-pointer items-center gap-1"
      onClick={() => onSortChange(field)}
      aria-label={sortButtonLabel}
    >
      {label}
      <SortIcon active={sortBy === field} sortDir={sortDir} />
    </button>
  );
}

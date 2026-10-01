import { FoodSortDirection } from '@/api/food-types';

/** `aria-sort` value for a column header, given the active sort state. */
export function sortAriaValue<TField extends string>(
  sortBy: TField | null,
  sortDir: FoodSortDirection,
  field: TField,
) {
  if (sortBy !== field) {
    return 'none' as const;
  }
  return sortDir === FoodSortDirection.Descending ? ('descending' as const) : ('ascending' as const);
}

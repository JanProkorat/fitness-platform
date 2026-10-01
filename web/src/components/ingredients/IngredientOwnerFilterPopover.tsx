import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FoodOwnerFilter } from '@/api/food-types';

const OWNER_ORDER: readonly FoodOwnerFilter[] = [
  FoodOwnerFilter.Mine,
  FoodOwnerFilter.System,
  FoodOwnerFilter.OtherCoaches,
];

interface Props {
  selectedOwners: FoodOwnerFilter[];
  onChange: (owners: FoodOwnerFilter[]) => void;
}

/**
 * Multi-select Owner filter pill (#1139) — the backend's search endpoint ORs
 * together any number of `FoodOwnerFilter` values (`SearchFoodsRequest.Owner`
 * is a list bound from the repeated `owner` query param), same "match any"
 * shape as the Category and Tags filters. Built on the same Popover +
 * Checkbox primitives those two use (`MultiSelectPopover.tsx` is the generic
 * version of this pattern used by the drawer's dropdown-style fields — this
 * filter-bar pill mirrors `IngredientCategoryFilterPopover` instead so it
 * sits visually consistent next to Category/Tags).
 */
export default function IngredientOwnerFilterPopover({ selectedOwners, onChange }: Props) {
  const { t } = useTranslation();

  function toggleOwner(owner: FoodOwnerFilter) {
    onChange(selectedOwners.includes(owner) ? selectedOwners.filter((o) => o !== owner) : [...selectedOwners, owner]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-full">
          <Plus className="size-3" aria-hidden="true" />
          {t('ingredients.filters.owner')}
          {selectedOwners.length > 0 && <span className="text-caption">{selectedOwners.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56">
        <ul className="flex flex-col gap-2.5">
          {OWNER_ORDER.map((owner) => (
            <li key={owner}>
              <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                <Checkbox checked={selectedOwners.includes(owner)} onCheckedChange={() => toggleOwner(owner)} />
                {t(`ingredients.filters.ownerOptions.${owner}`)}
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

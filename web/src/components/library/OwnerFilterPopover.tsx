import { useTranslation } from 'react-i18next';
import FilterChip from '@/components/library/FilterChip';
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
 * Multi-select Owner filter pill shared by the Ingredients and Recipes pages.
 * Selecting several owners ORs them ("match any"); none selected applies no
 * owner filter. Built on the same Popover + Checkbox primitives as the other
 * filter-bar pills.
 */
export default function OwnerFilterPopover({ selectedOwners, onChange }: Props) {
  const { t } = useTranslation();

  function toggleOwner(owner: FoodOwnerFilter) {
    onChange(selectedOwners.includes(owner) ? selectedOwners.filter((o) => o !== owner) : [...selectedOwners, owner]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterChip label={t('library.filters.owner')} count={selectedOwners.length} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56">
        <ul className="flex flex-col gap-2.5">
          {OWNER_ORDER.map((owner) => (
            <li key={owner}>
              <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                <Checkbox checked={selectedOwners.includes(owner)} onCheckedChange={() => toggleOwner(owner)} />
                {t(`library.filters.ownerOptions.${owner}`)}
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

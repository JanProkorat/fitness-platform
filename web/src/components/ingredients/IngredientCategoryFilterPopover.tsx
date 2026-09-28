import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FoodCategory } from '@/api/food-types';

const CATEGORY_ORDER: readonly FoodCategory[] = [
  FoodCategory.Fruit,
  FoodCategory.Vegetables,
  FoodCategory.Meat,
  FoodCategory.FishAndSeafood,
  FoodCategory.Dairy,
  FoodCategory.GrainsAndCereals,
  FoodCategory.Legumes,
  FoodCategory.NutsAndSeeds,
  FoodCategory.OilsAndFats,
  FoodCategory.SweetsAndSnacks,
  FoodCategory.Beverages,
  FoodCategory.Supplements,
  FoodCategory.Other,
];

interface Props {
  selectedCategory?: FoodCategory;
  onChange: (category: FoodCategory | undefined) => void;
}

/**
 * Single-select Category filter pill — the backend's search endpoint filters
 * on at most one `FoodCategory` (`SearchFoodsRequest.Category` is a nullable
 * enum, not a list), unlike the Tags filter. Built on the same Popover +
 * Checkbox primitives as `IngredientTagFilterPopover` for visual consistency,
 * but a re-click of the already-selected category (or of another one)
 * replaces the selection instead of adding to it.
 */
export default function IngredientCategoryFilterPopover({ selectedCategory, onChange }: Props) {
  const { t } = useTranslation();

  function toggleCategory(category: FoodCategory) {
    onChange(selectedCategory === category ? undefined : category);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          {t('ingredients.filters.category')}
          {selectedCategory && <span className="text-caption">1</span>}
          <ChevronDown className="size-3" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <ul className="flex max-h-64 flex-col gap-2.5 overflow-y-auto">
          {CATEGORY_ORDER.map((category) => (
            <li key={category}>
              <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                <Checkbox checked={selectedCategory === category} onCheckedChange={() => toggleCategory(category)} />
                {t(`ingredients.category.${category}`)}
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

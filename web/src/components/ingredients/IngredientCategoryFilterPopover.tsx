import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
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
  selectedCategories: FoodCategory[];
  onChange: (categories: FoodCategory[]) => void;
}

/**
 * Multi-select Category filter pill — the backend's search endpoint filters
 * on any number of `FoodCategory` values (`SearchFoodsRequest.Categories` is
 * a list bound from the repeated `category` query param), same "match any"
 * shape as the Tags filter. Mirrors `IngredientTagFilterPopover`, built on
 * the same Popover + Checkbox primitives for visual consistency.
 */
export default function IngredientCategoryFilterPopover({ selectedCategories, onChange }: Props) {
  const { t } = useTranslation();

  function toggleCategory(category: FoodCategory) {
    onChange(
      selectedCategories.includes(category)
        ? selectedCategories.filter((c) => c !== category)
        : [...selectedCategories, category],
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-full">
          <Plus className="size-3" aria-hidden="true" />
          {t('ingredients.filters.category')}
          {selectedCategories.length > 0 && <span className="text-caption">{selectedCategories.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <ul className="flex max-h-64 flex-col gap-2.5 overflow-y-auto">
          {CATEGORY_ORDER.map((category) => (
            <li key={category}>
              <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                <Checkbox
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={() => toggleCategory(category)}
                />
                {t(`ingredients.category.${category}`)}
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

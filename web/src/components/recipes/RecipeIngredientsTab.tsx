import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useIngredientSearch } from '@/hooks/useRecipesQueries';
import type { FoodSummary } from '@/api/food-types';
import { divideMacros, macrosForAmount, sumMacros } from '@/lib/recipe-nutrition';
import { isValidAmount, newKey, parseAmount, type IngredientLine } from '@/components/recipes/recipe-form-types';

interface Props {
  lines: IngredientLine[];
  onLinesChange: (lines: IngredientLine[]) => void;
  readOnly: boolean;
  /** Servings currently entered on the Details tab. */
  servings: number;
  /** Set after a failed save attempt, to flag an empty list or a bad amount. */
  showErrors: boolean;
}

function lineFromFood(food: FoodSummary): IngredientLine {
  return {
    key: newKey(),
    foodId: food.foodId ?? '',
    name: food.name ?? '',
    per100: {
      kcal: food.nutrientValue?.kcal ?? 0,
      protein: food.nutrientValue?.protein ?? 0,
      carbs: food.nutrientValue?.carbs ?? 0,
      fat: food.nutrientValue?.fat ?? 0,
    },
    allergens: food.allergens ?? [],
    amountText: '100',
  };
}

/**
 * The recipe drawer's Ingredients tab: search foods (own + public + system),
 * set grams per line, and read live totals pinned at the bottom. Per-serving
 * values are the totals divided by the Details tab's servings.
 */
export default function RecipeIngredientsTab({ lines, onLinesChange, readOnly, servings, showErrors }: Props) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const debouncedTerm = useDebouncedValue(searchInput, 300);
  const term = searchInput.trim() === '' ? '' : debouncedTerm.trim();
  const searchQuery = useIngredientSearch(term);

  const results = (searchQuery.data?.foods ?? []).filter(
    (food) => food.foodId && !lines.some((line) => line.foodId === food.foodId),
  );

  const total = sumMacros(lines.map((line) => macrosForAmount(line.per100, parseAmount(line.amountText))));
  const perServing = divideMacros(total, servings);

  function addFood(food: FoodSummary) {
    onLinesChange([...lines, lineFromFood(food)]);
    setSearchInput('');
  }

  function updateAmount(key: string, amountText: string) {
    onLinesChange(lines.map((line) => (line.key === key ? { ...line, amountText } : line)));
  }

  function removeLine(key: string) {
    onLinesChange(lines.filter((line) => line.key !== key));
  }

  return (
    <div className="flex min-h-full flex-col gap-3">
      {!readOnly && (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('recipes.ingredientsTab.searchPlaceholder')}
              aria-label={t('recipes.ingredientsTab.searchLabel')}
              className="h-10 pl-9"
            />
          </div>
          {term !== '' && (
            <ul className="flex max-h-56 flex-col overflow-y-auto rounded-md border border-border bg-card">
              {searchQuery.isPending && (
                <li className="px-3 py-2 text-body text-muted-foreground">{t('recipes.ingredientsTab.searching')}</li>
              )}
              {!searchQuery.isPending && results.length === 0 && (
                <li className="px-3 py-2 text-body text-muted-foreground">{t('recipes.ingredientsTab.noResults')}</li>
              )}
              {results.map((food) => (
                <li key={food.foodId}>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-body text-foreground hover:bg-muted"
                    onClick={() => addFood(food)}
                  >
                    <span>{food.name}</span>
                    <span className="text-meta text-muted-foreground">
                      {t('recipes.ingredientsTab.kcalPer100', { count: Math.round(food.nutrientValue?.kcal ?? 0) })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {lines.length === 0 ? (
        <p className="py-6 text-center text-body text-muted-foreground">{t('recipes.ingredientsTab.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => {
            const lineKcal = macrosForAmount(line.per100, parseAmount(line.amountText)).kcal;
            const invalid = showErrors && !isValidAmount(line.amountText);
            return (
              <li
                key={line.key}
                className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <span className="flex-1 text-body font-semibold text-foreground">{line.name}</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={line.amountText}
                  disabled={readOnly}
                  aria-invalid={invalid}
                  aria-label={t('recipes.ingredientsTab.amountLabel', { name: line.name })}
                  onChange={(event) => updateAmount(line.key, event.target.value)}
                  className="h-8 w-20 text-right"
                />
                <span className="text-meta text-muted-foreground">{t('recipes.ingredientsTab.gramsUnit')}</span>
                <span className="w-20 text-right text-meta text-muted-foreground">
                  {t('recipes.ingredientsTab.kcalValue', { count: Math.round(lineKcal) })}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                    aria-label={t('recipes.ingredientsTab.removeIngredient', { name: line.name })}
                    onClick={() => removeLine(line.key)}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showErrors && lines.length === 0 && (
        <p className="text-meta text-destructive">{t('recipes.ingredientsTab.foodsRequired')}</p>
      )}
      {showErrors && lines.some((line) => !isValidAmount(line.amountText)) && (
        <p className="text-meta text-destructive">{t('recipes.ingredientsTab.amountInvalid')}</p>
      )}

      <div
        className="sticky bottom-0 mt-auto flex items-center justify-between gap-4 rounded-md bg-muted px-3 py-2 text-meta text-muted-foreground"
        data-testid="recipe-macro-summary"
      >
        <span>
          {t('recipes.ingredientsTab.total')}{' '}
          <strong className="text-foreground">
            {t('recipes.ingredientsTab.kcalValue', { count: Math.round(total.kcal) })}
          </strong>{' '}
          · {t('library.nutrient.protein', { count: Math.round(total.protein) })} ·{' '}
          {t('library.nutrient.carbs', { count: Math.round(total.carbs) })} ·{' '}
          {t('library.nutrient.fat', { count: Math.round(total.fat) })}
        </span>
        <span>
          {t('recipes.ingredientsTab.perServing', { count: servings })}{' '}
          <strong className="text-foreground">
            {t('recipes.ingredientsTab.kcalValue', { count: Math.round(perServing.kcal) })}
          </strong>{' '}
          · {t('library.nutrient.protein', { count: Math.round(perServing.protein) })} ·{' '}
          {t('library.nutrient.carbs', { count: Math.round(perServing.carbs) })} ·{' '}
          {t('library.nutrient.fat', { count: Math.round(perServing.fat) })}
        </span>
      </div>
    </div>
  );
}

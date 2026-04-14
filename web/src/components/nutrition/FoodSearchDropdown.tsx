import { useTranslation } from 'react-i18next';
import type { FoodSummary } from '@/api/food-types';
import type { MealFood } from '@/api/plan-types';

interface FoodSearchDropdownProps {
  query: string;
  onQueryChange: (query: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  loading: boolean;
  results: FoodSummary[];
  staged: MealFood[];
  onSelectFood: (food: FoodSummary) => void;
}

export function FoodSearchDropdown({
  query,
  onQueryChange,
  onFocus,
  onBlur,
  inputRef,
  loading,
  results,
  staged,
  onSelectFood,
}: FoodSearchDropdownProps) {
  const { t } = useTranslation();

  return (
    <div className="relative mb-6">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text3">
        {t('nutrition.searchFoods')}
      </label>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        onBlur={() => setTimeout(onBlur, 200)}
        placeholder={t('nutrition.searchFoods')}
        className="w-full rounded-md border border-border-md bg-bg px-3 py-2 text-sm text-text outline-none placeholder:text-text3 focus:border-border-hv"
      />

      {loading && (
        <div className="absolute left-0 right-0 z-10 mt-2 rounded-sm border border-border bg-bg px-3 py-2 text-center text-xs text-text3 shadow-lg">{t('common.loading')}</div>
      )}

      {!loading && results.length > 0 && (
        <div className="absolute left-0 right-0 z-10 mt-2 max-h-40 overflow-y-auto rounded-sm border border-border bg-bg shadow-lg" onMouseDown={(e) => e.preventDefault()}>
          {results.map((food) => {
            const isSelected = staged.some((s) => s.foodExternalId === food.foodId);
            return (
              <button
                key={food.foodId}
                onClick={() => onSelectFood(food)}
                disabled={isSelected}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-accent-bg text-accent opacity-60'
                    : 'hover:bg-bg-hover'
                }`}
              >
                <span className="truncate font-medium">{food.name}</span>
                <span className="ml-3 shrink-0 text-xs text-text3">
                  {Math.round(food.nutrientValue.kcal)} kcal
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!loading && (!query.trim() && results.length === 0) || (query.trim() && results.length === 0) ? (
        <div className="absolute left-0 right-0 z-10 mt-2 rounded-sm border border-border bg-bg px-3 py-2 text-center text-xs text-text3 shadow-lg">{t('foods.noFoods')}</div>
      ) : null}
    </div>
  );
}

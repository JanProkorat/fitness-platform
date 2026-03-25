import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { searchFoods } from '@/api/foods';
import { searchRecipes, getRecipe } from '@/api/recipes';
import type { FoodSummary } from '@/api/food-types';
import type { RecipeSummary } from '@/api/recipe-types';
import type { MealFood } from '@/api/plan-types';

interface AddItemsDrawerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (items: MealFood[]) => void;
}

export default function AddItemsDrawer({ open, onClose, onAdd }: AddItemsDrawerProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [staged, setStaged] = useState<MealFood[]>([]);

  // Food search state
  const [foodQuery, setFoodQuery] = useState('');
  const [foodSource, setFoodSource] = useState('');
  const [foodResults, setFoodResults] = useState<FoodSummary[]>([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const foodInputRef = useRef<HTMLInputElement>(null);

  // Recipe search state
  const [recipeQuery, setRecipeQuery] = useState('');
  const [recipeResults, setRecipeResults] = useState<RecipeSummary[]>([]);
  const [recipeLoading, setRecipeLoading] = useState(false);

  // Animate in
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      // Reset state
      setStaged([]);
      setFoodQuery('');
      setFoodSource('');
      setFoodResults([]);
      setRecipeQuery('');
      setRecipeResults([]);
      setFoodOpen(false);
      setRecipeOpen(false);
    } else {
      setVisible(false);
    }
  }, [open]);


  // Food search — loads on focus, stays open until drawer closes
  const [foodOpen, setFoodOpen] = useState(false);
  useEffect(() => {
    if (!foodOpen && !foodQuery.trim()) {
      setFoodResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setFoodLoading(true);
      try {
        const data = await searchFoods({ q: foodQuery || undefined, source: foodSource || undefined, pageSize: 15 });
        setFoodResults(data.foods ?? []);
      } catch {
        setFoodResults([]);
      } finally {
        setFoodLoading(false);
      }
    }, foodQuery.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [foodQuery, foodSource, foodOpen]);

  // Recipe search — loads on focus, stays open until drawer closes
  const [recipeOpen, setRecipeOpen] = useState(false);
  useEffect(() => {
    if (!recipeOpen && !recipeQuery.trim()) {
      setRecipeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setRecipeLoading(true);
      try {
        const data = await searchRecipes({ search: recipeQuery || undefined, page: 1, pageSize: 15 });
        setRecipeResults(data.recipes ?? []);
      } catch {
        setRecipeResults([]);
      } finally {
        setRecipeLoading(false);
      }
    }, recipeQuery.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [recipeQuery, recipeOpen]);

  const addFoodToStaged = useCallback((food: FoodSummary) => {
    // Check if already staged
    if (staged.some((s) => s.foodExternalId === food.foodId)) return;
    setStaged((prev) => [
      ...prev,
      {
        foodExternalId: food.foodId,
        foodName: food.name,
        nutrientValuePer100Grams: {
          kcal: food.nutrientValue.kcal,
          protein: food.nutrientValue.protein,
          carbs: food.nutrientValue.carbs,
          fat: food.nutrientValue.fat,
          fiber: food.nutrientValue.fiber,
          sugar: food.nutrientValue.sugar,
          saturatedFat: food.nutrientValue.saturatedFat,
          salt: food.nutrientValue.salt,
        },
        amountGrams: 100,
      },
    ]);
  }, [staged]);

  const addRecipeToStaged = useCallback(async (recipe: RecipeSummary) => {
    try {
      const detail = await getRecipe(recipe.recipeId);
      setStaged((prev) => {
        const existingIds = new Set(prev.map((s) => s.foodExternalId));
        const newFoods = detail.foods
          .filter((f) => !existingIds.has(f.foodExternalId))
          .map((f) => ({
            foodExternalId: f.foodExternalId,
            foodName: f.foodName,
            nutrientValuePer100Grams: {
              kcal: f.nutrientValuePer100Grams.kcal,
              protein: f.nutrientValuePer100Grams.protein,
              carbs: f.nutrientValuePer100Grams.carbs,
              fat: f.nutrientValuePer100Grams.fat,
              fiber: f.nutrientValuePer100Grams.fiber,
              sugar: f.nutrientValuePer100Grams.sugar,
              saturatedFat: f.nutrientValuePer100Grams.saturatedFat,
              salt: f.nutrientValuePer100Grams.salt,
            },
            amountGrams: f.amountGrams,
          }));
        return [...prev, ...newFoods];
      });
    } catch {
      // silently ignore
    }
  }, []);

  const removeStagedItem = (foodExternalId: string) => {
    setStaged((prev) => prev.filter((s) => s.foodExternalId !== foodExternalId));
  };

  const updateStagedAmount = (foodExternalId: string, amountGrams: number) => {
    setStaged((prev) =>
      prev.map((s) => (s.foodExternalId === foodExternalId ? { ...s, amountGrams } : s)),
    );
  };

  const handleAdd = () => {
    if (staged.length === 0) return;
    onAdd(staged);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 flex h-full w-[480px] flex-col border-l border-border bg-bg shadow-2xl transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <span className="text-sm font-semibold">{t('nutrition.addItems', 'Add Items')}</span>
          <button
            onClick={handleClose}
            className="text-text3 transition-colors hover:text-text"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Food search */}
          <div className="relative mb-6">
            <label className="mb-2 block font-heading text-xs font-semibold uppercase tracking-wide text-text3">
              {t('nutrition.searchFoods')}
            </label>
            <div className="flex gap-2">
              <input
                ref={foodInputRef}
                type="text"
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                onFocus={() => setFoodOpen(true)}
                onBlur={() => setTimeout(() => setFoodOpen(false), 200)}
                placeholder={t('nutrition.searchFoods')}
                className="flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-gold/40"
              />
              <select
                value={foodSource}
                onChange={(e) => setFoodSource(e.target.value)}
                className="rounded-sm border border-border bg-surface px-2 py-2 text-xs text-text outline-none focus:border-gold/40"
              >
                <option value="">{t('foods.sourceAll')}</option>
                <option value="system">{t('foods.sourceSystem')}</option>
                <option value="custom">{t('foods.sourceCustom')}</option>
                <option value="openfoodfacts">{t('foods.sourceOpenFoodFacts')}</option>
              </select>
            </div>

            {foodLoading && (
              <div className="absolute left-0 right-0 z-10 mt-2 rounded-sm border border-border bg-bg px-3 py-2 text-center text-xs text-text3 shadow-lg">{t('common.loading')}</div>
            )}

            {!foodLoading && foodResults.length > 0 && (
              <div className="absolute left-0 right-0 z-10 mt-2 max-h-40 overflow-y-auto rounded-sm border border-border bg-bg shadow-lg" onMouseDown={(e) => e.preventDefault()}>
                {foodResults.map((food) => {
                  const isSelected = staged.some((s) => s.foodExternalId === food.foodId);
                  return (
                    <button
                      key={food.foodId}
                      onClick={() => addFoodToStaged(food)}
                      disabled={isSelected}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-gold/10 text-gold opacity-60'
                          : 'hover:bg-gold/5'
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

            {!foodLoading && (foodOpen || foodQuery.trim()) && foodResults.length === 0 && (
              <div className="absolute left-0 right-0 z-10 mt-2 rounded-sm border border-border bg-bg px-3 py-2 text-center text-xs text-text3 shadow-lg">{t('foods.noFoods')}</div>
            )}
          </div>

          {/* Recipe search */}
          <div className="relative mb-6">
            <label className="mb-2 block font-heading text-xs font-semibold uppercase tracking-wide text-text3">
              {t('recipes.searchRecipes')}
            </label>
            <input
              type="text"
              value={recipeQuery}
              onChange={(e) => setRecipeQuery(e.target.value)}
              onFocus={() => setRecipeOpen(true)}
              onBlur={() => setTimeout(() => setRecipeOpen(false), 200)}
              placeholder={t('recipes.searchRecipes')}
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-gold/40"
            />

            {recipeLoading && (
              <div className="absolute left-0 right-0 z-10 mt-2 rounded-sm border border-border bg-bg px-3 py-2 text-center text-xs text-text3 shadow-lg">{t('common.loading')}</div>
            )}

            {!recipeLoading && recipeResults.length > 0 && (
              <div className="absolute left-0 right-0 z-10 mt-2 max-h-40 overflow-y-auto rounded-sm border border-border bg-bg shadow-lg" onMouseDown={(e) => e.preventDefault()}>
                {recipeResults.map((recipe) => (
                  <button
                    key={recipe.recipeId}
                    onClick={() => addRecipeToStaged(recipe)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-gold/5"
                  >
                    <span className="truncate font-medium">{recipe.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-text3">
                      {recipe.foodCount} {t('recipes.foods')} | {Math.round(recipe.totalNutrients.kcal)} kcal
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!recipeLoading && (recipeOpen || recipeQuery.trim()) && recipeResults.length === 0 && (
              <div className="absolute left-0 right-0 z-10 mt-2 rounded-sm border border-border bg-bg px-3 py-2 text-center text-xs text-text3 shadow-lg">{t('recipes.noResults')}</div>
            )}
          </div>

          {/* Staged items table */}
          {staged.length > 0 && (
            <div>
              <label className="mb-2 block font-heading text-xs font-semibold uppercase tracking-wide text-text3">
                {t('nutrition.selectedItems', 'Selected Items')} ({staged.length})
              </label>
              <div className="rounded-sm border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase text-text3">
                      <th className="px-3 py-2 font-medium">Food</th>
                      <th className="w-20 px-2 py-2 font-medium">{t('nutrition.grams')}</th>
                      <th className="w-14 px-2 py-2 text-right font-medium">kcal</th>
                      <th className="w-10 px-2 py-2 text-right font-medium">P</th>
                      <th className="w-10 px-2 py-2 text-right font-medium">C</th>
                      <th className="w-10 px-2 py-2 text-right font-medium">F</th>
                      <th className="w-8 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {staged.map((item) => {
                      const scale = item.amountGrams / 100;
                      return (
                        <tr key={item.foodExternalId} className="border-t border-charcoal">
                          <td className="truncate px-3 py-2 text-text2">{item.foodName}</td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={1}
                              value={item.amountGrams}
                              onChange={(e) =>
                                updateStagedAmount(
                                  item.foodExternalId,
                                  Math.max(1, Number(e.target.value) || 1),
                                )
                              }
                              className="w-16 rounded-sm border border-border bg-surface px-1.5 py-0.5 text-xs text-text outline-none focus:border-gold/40"
                            />
                          </td>
                          <td className="px-2 py-2 text-right text-text3">
                            {Math.round(item.nutrientValuePer100Grams.kcal * scale)}
                          </td>
                          <td className="px-2 py-2 text-right text-blue-400">
                            {Math.round(item.nutrientValuePer100Grams.protein * scale)}
                          </td>
                          <td className="px-2 py-2 text-right text-amber-400">
                            {Math.round(item.nutrientValuePer100Grams.carbs * scale)}
                          </td>
                          <td className="px-2 py-2 text-right text-rose-400">
                            {Math.round(item.nutrientValuePer100Grams.fat * scale)}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              onClick={() => removeStagedItem(item.foodExternalId)}
                              className="text-text3 transition-colors hover:text-red-400"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sticky add button */}
        <div className="shrink-0 border-t border-border bg-bg px-6 py-4">
          <button
            onClick={handleAdd}
            disabled={staged.length === 0}
            className="w-full rounded-sm bg-gold px-5 py-3 font-heading text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
          >
            {t('nutrition.addToMeal', 'Add to Meal')} ({staged.length})
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

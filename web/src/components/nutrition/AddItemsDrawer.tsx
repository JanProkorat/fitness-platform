import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { searchFoods } from '@/api/foods';
import { searchRecipes, getRecipe } from '@/api/recipes';
import type { FoodSummary } from '@/api/food-types';
import type { RecipeSummary } from '@/api/recipe-types';
import type { MealFood } from '@/api/plan-types';
import { FoodSearchDropdown } from './FoodSearchDropdown';
import { RecipeSearchDropdown } from './RecipeSearchDropdown';
import { StagedFoodsTable } from './StagedFoodsTable';
import { StagedRecipesTable } from './StagedRecipesTable';
import { foodToMealFood, expandRecipesIntoFoods, isFoodAlreadyStaged, isRecipeAlreadyStaged } from './AddItemsDrawer-helpers';
import type { StagedRecipe, AddItemsDrawerProps } from './AddItemsDrawer-types';

export default function AddItemsDrawer({ open, onClose, onAdd }: AddItemsDrawerProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [staged, setStaged] = useState<MealFood[]>([]);
  const [stagedRecipes, setStagedRecipes] = useState<StagedRecipe[]>([]);

  // Food search state
  const [foodQuery, setFoodQuery] = useState('');
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
      setStagedRecipes([]);
      setFoodQuery('');
      setFoodResults([]);
      setRecipeQuery('');
      setRecipeResults([]);
      setFoodOpen(false);
      setRecipeOpen(false);
    } else {
      setVisible(false);
    }
  }, [open]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);


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
        const data = await searchFoods({ q: foodQuery || undefined, pageSize: 15 });
        setFoodResults(data.foods ?? []);
      } catch {
        setFoodResults([]);
      } finally {
        setFoodLoading(false);
      }
    }, foodQuery.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [foodQuery, foodOpen]);

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
    if (isFoodAlreadyStaged(food, staged)) return;
    setStaged((prev) => [...prev, foodToMealFood(food)]);
  }, [staged]);

  const addRecipeToStaged = useCallback(async (recipe: RecipeSummary) => {
    if (isRecipeAlreadyStaged(recipe, stagedRecipes)) return;
    try {
      const detail = await getRecipe(recipe.recipeId);
      setStagedRecipes((prev) => [...prev, { recipe: detail, portions: 1 }]);
    } catch {
      // silently ignore
    }
  }, [stagedRecipes]);

  const removeStagedItem = (foodExternalId: string) => {
    setStaged((prev) => prev.filter((s) => s.foodExternalId !== foodExternalId));
  };

  const updateStagedAmount = (foodExternalId: string, amountGrams: number) => {
    setStaged((prev) =>
      prev.map((s) => (s.foodExternalId === foodExternalId ? { ...s, amountGrams } : s)),
    );
  };

  const removeStagedRecipe = (recipeId: string) => {
    setStagedRecipes((prev) => prev.filter((s) => s.recipe.recipeId !== recipeId));
  };

  const updateRecipePortions = (recipeId: string, portions: number) => {
    setStagedRecipes((prev) =>
      prev.map((s) => (s.recipe.recipeId === recipeId ? { ...s, portions } : s)),
    );
  };

  const handleAdd = () => {
    const totalItems = staged.length + stagedRecipes.length;
    if (totalItems === 0) return;

    const recipeFoods = expandRecipesIntoFoods(stagedRecipes);
    onAdd([...staged, ...recipeFoods]);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const totalItemCount = staged.length + stagedRecipes.length;

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
            aria-label="Close drawer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          <FoodSearchDropdown
            query={foodQuery}
            onQueryChange={setFoodQuery}
            onFocus={() => setFoodOpen(true)}
            onBlur={() => setFoodOpen(false)}
            inputRef={foodInputRef}
            loading={foodLoading}
            results={foodResults}
            staged={staged}
            onSelectFood={addFoodToStaged}
          />

          <RecipeSearchDropdown
            query={recipeQuery}
            onQueryChange={setRecipeQuery}
            onFocus={() => setRecipeOpen(true)}
            onBlur={() => setRecipeOpen(false)}
            loading={recipeLoading}
            results={recipeResults}
            stagedRecipes={stagedRecipes}
            onSelectRecipe={addRecipeToStaged}
          />

          <StagedFoodsTable
            items={staged}
            onRemove={removeStagedItem}
            onUpdateAmount={updateStagedAmount}
          />

          <StagedRecipesTable
            items={stagedRecipes}
            onRemove={removeStagedRecipe}
            onUpdatePortions={updateRecipePortions}
          />
        </div>

        {/* Sticky add button */}
        <div className="shrink-0 border-t border-border bg-bg px-6 py-4">
          <button
            onClick={handleAdd}
            disabled={totalItemCount === 0}
            className="w-full rounded-sm bg-accent px-5 py-3 text-xs font-bold uppercase tracking-wide text-bg transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {t('nutrition.addToMeal', 'Add to Meal')} ({totalItemCount})
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

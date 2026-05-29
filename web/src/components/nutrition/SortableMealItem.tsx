import { useState } from 'react';
import { Button, Dialog } from '@/components/ui';
import { MealBlock } from '@/components/nutrition';
import type { MealBlockFood } from '@/components/nutrition';
import type { PlanMeal } from '@/api/plan-types';
import { resolveLocalizedName } from '@/lib/nutrition-helpers';
import { CompletionBadge } from '@/components/training/CompletionBadge';

interface SortableMealItemProps {
  meal: PlanMeal;
  index: number;
  dayOfWeek: number;
  weekNumber: number;
  isOpen: boolean;
  onToggle: () => void;
  onFoodAmountChange: (foodId: string, amount: number) => void;
  onFoodRemove: (foodId: string) => void;
  onFoodSelect: (food: { name: string; kcal: number; protein: number; carbs: number; fat: number }) => void;
  onRecipeSelect: (recipe: { recipeId: string; name: string; kcal: number; protein: number; carbs: number; fat: number; foodCategories?: string[] }) => void;
  onRecipeServingsChange: (recipeId: string, servings: number) => void;
  onRecipeRemove: (recipeId: string) => void;
  onRecipeNoteChange: (recipeId: string, note: string) => void;
  onNoteChange: (note: string) => void;
  onFoodNoteChange: (foodId: string, note: string) => void;
  onItemDrop: (data: { type: string; foodId?: string; recipeId?: string; mealId: string; dayOfWeek?: number }) => void;
  onReorder: (itemIds: string[]) => void;
  onTimeChange: (time: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  lang: string;
  removeMealTitle: string;
  removeMealMessage: string;
  cancelLabel: string;
  removeLabel: string;
  /**
   * When true the meal has been confirmed eaten by the client.
   * Hides the remove-meal button, the food/recipe search inputs, and
   * shows the eaten CompletionBadge. The remove/add affordances pass
   * undefined to MealBlock so it omits them conditionally.
   */
  locked?: boolean;
}

/** Sortable wrapper for a meal in the day list */
export function SortableMealItem({
  meal,
  dayOfWeek,
  weekNumber: weekNum,
  isOpen,
  onToggle,
  onFoodAmountChange,
  onFoodRemove,
  onFoodSelect,
  onRecipeSelect,
  onRecipeServingsChange,
  onRecipeRemove,
  onRecipeNoteChange,
  onNoteChange,
  onFoodNoteChange,
  onItemDrop,
  onReorder,
  onTimeChange,
  onDuplicate,
  onRemove,
  lang,
  removeMealTitle,
  removeMealMessage,
  cancelLabel,
  removeLabel,
  locked = false,
}: SortableMealItemProps) {

  const mealFoods: MealBlockFood[] = meal.foods.map((f) => {
    const scale = f.amountGrams / 100;
    return {
      id: f.foodExternalId,
      name: resolveLocalizedName(f, lang),
      amount: f.amountGrams,
      unit: 'g',
      kcal: f.nutrientValuePer100Grams.kcal * scale,
      protein: f.nutrientValuePer100Grams.protein * scale,
      carbs: f.nutrientValuePer100Grams.carbs * scale,
      fat: f.nutrientValuePer100Grams.fat * scale,
      note: f.note,
      category: f.foodCategory,
    };
  });

  const mealRecipes = (meal.recipes ?? []).map((r) => ({
    recipeId: r.recipeId,
    recipeName: r.recipeName,
    servings: r.servings,
    kcal: r.nutrientValuePerServing.kcal,
    protein: r.nutrientValuePerServing.protein,
    carbs: r.nutrientValuePerServing.carbs,
    fat: r.nutrientValuePerServing.fat,
    note: r.note,
    foodCategories: r.foodCategories,
  }));

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [mealOver, setMealOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/meal-json', JSON.stringify({ type: 'meal', mealId: meal.mealId, fromDay: dayOfWeek, fromWeek: weekNum }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        // Only accept meal drags (not food/recipe)
        if (e.dataTransfer.types.includes('application/meal-json')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setMealOver(true);
        }
      }}
      onDragLeave={() => setMealOver(false)}
      onDrop={(e) => {
        setMealOver(false);
        if (!e.dataTransfer.types.includes('application/meal-json')) return;
        e.preventDefault();
        // meal reorder handled by parent
      }}
      data-meal-id={meal.mealId}
      style={{
        borderTop: mealOver ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'border-color 0.1s',
        position: 'relative',
      }}
    >
      {locked && (
        <div className="absolute right-8 top-2 z-10 pointer-events-none">
          <CompletionBadge kind="meal" state="eaten" />
        </div>
      )}
      <MealBlock
        mealId={meal.mealId}
        dayOfWeek={dayOfWeek}
        weekNumber={weekNum}
        kind={meal.kind}
        time={meal.time ?? undefined}
        note={meal.note}
        foods={mealFoods}
        recipes={mealRecipes}
        isOpen={isOpen}
        onToggle={onToggle}
        onFoodAmountChange={onFoodAmountChange}
        onFoodRemove={onFoodRemove}
        onFoodNoteChange={onFoodNoteChange}
        onFoodSelect={locked ? undefined : onFoodSelect}
        onRecipeSelect={locked ? undefined : onRecipeSelect}
        onRecipeServingsChange={locked ? undefined : onRecipeServingsChange}
        onRecipeRemove={locked ? undefined : onRecipeRemove}
        onRecipeNoteChange={onRecipeNoteChange}
        mealTotalKcal={meal.mealTotals?.kcal ?? 0}
        onNoteChange={onNoteChange}
        onItemDrop={locked ? undefined : onItemDrop}
        onReorder={locked ? undefined : onReorder}
        onTimeChange={locked ? undefined : onTimeChange}
        onDuplicate={locked ? undefined : onDuplicate}
        onRemove={locked ? undefined : () => setConfirmRemove(true)}
      />
      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={removeMealTitle}
        maxWidth={380}
        footer={
          <>
            <Button onClick={() => setConfirmRemove(false)}>{cancelLabel}</Button>
            <Button variant="danger" onClick={() => { setConfirmRemove(false); onRemove(); }}>
              {removeLabel}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {removeMealMessage}
        </p>
      </Dialog>
    </div>
  );
}

export default SortableMealItem;

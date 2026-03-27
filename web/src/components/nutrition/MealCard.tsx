import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNutritionPlanStore } from '@/stores/nutritionPlan';
import type { PlanMeal, MealFood } from '@/api/plan-types';
import AddItemsDrawer from './AddItemsDrawer';

interface MealCardProps {
  meal: PlanMeal;
  weekNumber: number;
  dayOfWeek: number;
  targetKcal?: number | null;
}

export default function MealCard({ meal, weekNumber, dayOfWeek, targetKcal }: MealCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(meal.name);

  const updateFoodAmount = useNutritionPlanStore((s) => s.updateFoodAmount);
  const addFood = useNutritionPlanStore((s) => s.addFoodToMeal);
  const removeFood = useNutritionPlanStore((s) => s.removeFoodFromMeal);
  const updateMealName = useNutritionPlanStore((s) => s.updateMealName);
  const removeMeal = useNutritionPlanStore((s) => s.removeMeal);

  const handleNameSave = () => {
    if (nameValue.trim() && nameValue !== meal.name) {
      updateMealName(weekNumber, dayOfWeek, meal.mealId, nameValue.trim());
    }
    setEditingName(false);
  };

  const handleAddItems = (items: MealFood[]) => {
    for (const item of items) {
      addFood(weekNumber, dayOfWeek, meal.mealId, item);
    }
  };

  const totalKcal = Math.round(meal.mealTotals?.kcal ?? 0);
  const isOverTarget = targetKcal != null && totalKcal > targetKcal;
  const excess = isOverTarget ? totalKcal - targetKcal! : 0;

  return (
    <div className={`flex min-h-0 flex-1 flex-col rounded-sm border bg-bg ${isOverTarget ? 'border-l-red-500 border-l-2 border-border' : 'border-border'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-text3 transition-colors hover:text-accent"
        >
          {expanded ? '\u25BC' : '\u25B6'}
        </button>

        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
            className="flex-1 rounded-sm border border-border bg-bg2 px-2 py-0.5 text-sm text-text outline-none focus:border-border-hv"
          />
        ) : (
          <div className="flex flex-1 items-center gap-1.5 min-w-0">
            <button
              onClick={() => setEditingName(true)}
              className="text-left text-sm font-semibold transition-colors hover:text-accent truncate"
            >
              {meal.name}
            </button>
            {targetKcal != null && (
              <span className="text-[9px] text-text3 shrink-0">target {Math.round(targetKcal)}</span>
            )}
          </div>
        )}

        {meal.time && <span className="text-[11px] text-text3 shrink-0">{meal.time}</span>}

        {isOverTarget ? (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs font-semibold text-red-500">{totalKcal} kcal</span>
            <span className="text-[9px] text-red-500 font-bold">⚠️ +{Math.round(excess)}</span>
          </div>
        ) : (
          <span className="text-xs font-medium text-green-400 shrink-0">{totalKcal} kcal</span>
        )}

        <button
          onClick={() => removeMeal(weekNumber, dayOfWeek, meal.mealId)}
          className="ml-1 text-xs text-text3 transition-colors hover:text-red-400"
          title={t('nutrition.remove')}
        >
          &times;
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-3 py-2">
          {meal.foods.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-text3">
                  <th className="pb-1 pr-2 font-medium">Food</th>
                  <th className="w-16 pb-1 pr-2 font-medium">{t('nutrition.grams')}</th>
                  <th className="w-12 pb-1 pr-1 text-right font-medium">kcal</th>
                  <th className="w-10 pb-1 pr-1 text-right font-medium">P</th>
                  <th className="w-10 pb-1 pr-1 text-right font-medium">C</th>
                  <th className="w-10 pb-1 pr-1 text-right font-medium">F</th>
                  <th className="w-6 pb-1" />
                </tr>
              </thead>
              <tbody>
                {meal.foods.map((food) => {
                  const scale = food.amountGrams / 100;
                  return (
                    <tr key={food.foodExternalId} className="border-t border-border">
                      <td className="truncate py-1.5 pr-2 text-text2">{food.foodName}</td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          min={0}
                          value={food.amountGrams}
                          onChange={(e) =>
                            updateFoodAmount(
                              weekNumber,
                              dayOfWeek,
                              meal.mealId,
                              food.foodExternalId,
                              Math.max(0, Number(e.target.value) || 0),
                            )
                          }
                          className="w-14 rounded-sm border border-border bg-bg2 px-1.5 py-0.5 text-xs text-text outline-none focus:border-border-hv"
                        />
                      </td>
                      <td className="py-1.5 pr-1 text-right text-text3">
                        {Math.round(food.nutrientValuePer100Grams.kcal * scale)}
                      </td>
                      <td className="py-1.5 pr-1 text-right text-blue-400">
                        {Math.round(food.nutrientValuePer100Grams.protein * scale)}
                      </td>
                      <td className="py-1.5 pr-1 text-right text-amber-400">
                        {Math.round(food.nutrientValuePer100Grams.carbs * scale)}
                      </td>
                      <td className="py-1.5 pr-1 text-right text-rose-400">
                        {Math.round(food.nutrientValuePer100Grams.fat * scale)}
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          onClick={() =>
                            removeFood(weekNumber, dayOfWeek, meal.mealId, food.foodExternalId)
                          }
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
          )}

        </div>
      )}

      {/* Spacer to push button to bottom */}
      <div className="flex-1" />

      {/* Add items button — always visible at bottom */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="shrink-0 w-full border-t border-border bg-bg3 py-1.5 text-[9px] font-semibold uppercase text-text3 transition-colors hover:text-accent"
      >
        + {t('nutrition.addItems', 'Add Items')}
      </button>

      <AddItemsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAdd={handleAddItems}
      />
    </div>
  );
}

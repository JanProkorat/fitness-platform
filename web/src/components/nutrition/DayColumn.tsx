import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/react/sortable';
import { useNutritionPlanStore } from '@/stores/nutritionPlan';
import type { PlanDay, PlanMeal, GlobalNutritionSettings } from '@/api/plan-types';
import MacroProgressBar from './MacroProgressBar';
import MealCard from './MealCard';

interface DayColumnProps {
  day: PlanDay;
  weekNumber: number;
  dayLabel: string;
  globalSettings?: GlobalNutritionSettings | null;
  mealDistribution?: Record<string, number> | null;
  dailyKcal?: number | null;
  onDayDragStart: (dayOfWeek: number) => void;
  onDayDragOver: (dayOfWeek: number) => void;
  onDayDrop: (dayOfWeek: number) => void;
  isDragOver: boolean;
}

function SortableMealCard({
  meal,
  weekNumber,
  dayOfWeek,
  index,
  targetKcal,
}: {
  meal: PlanMeal;
  weekNumber: number;
  dayOfWeek: number;
  index: number;
  targetKcal?: number | null;
}) {
  const { ref, isDragging } = useSortable({
    id: meal.mealId,
    index,
    group: `meals-${weekNumber}-${dayOfWeek}`,
    type: 'meal',
    accept: 'meal',
  });

  return (
    <div
      ref={ref}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <MealCard
        meal={meal}
        weekNumber={weekNumber}
        dayOfWeek={dayOfWeek}
        targetKcal={targetKcal}
      />
    </div>
  );
}

export default function DayColumn({
  day,
  weekNumber,
  dayLabel,
  globalSettings,
  mealDistribution,
  dailyKcal,
  onDayDragStart,
  onDayDragOver,
  onDayDrop,
  isDragOver,
}: DayColumnProps) {
  const { t } = useTranslation();
  const addMeal = useNutritionPlanStore((s) => s.addMeal);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [newMealName, setNewMealName] = useState('');

  const dayKcal = Math.round(day.dayTotals?.kcal ?? 0);
  const hasTargets =
    globalSettings &&
    (globalSettings.dailyKcal || globalSettings.proteinGrams || globalSettings.carbsGrams || globalSettings.fatGrams);
  const isOverTarget =
    globalSettings?.dailyKcal && dayKcal > globalSettings.dailyKcal * 1.15;

  const dayTotals = {
    kcal: Math.round(day.dayTotals?.kcal ?? 0),
    protein: Math.round(day.dayTotals?.protein ?? 0),
    carbs: Math.round(day.dayTotals?.carbs ?? 0),
    fat: Math.round(day.dayTotals?.fat ?? 0),
  };

  // Distribution entries with non-zero percentages
  const distributionEntries = mealDistribution
    ? Object.entries(mealDistribution).filter(([, pct]) => pct > 0)
    : [];

  // Compute per-meal target kcal from distribution
  const getMealTargetKcal = (mealName: string): number | null => {
    if (!mealDistribution || dailyKcal == null || dailyKcal <= 0) return null;
    const pct = mealDistribution[mealName];
    if (pct == null) return null;
    return (pct / 100) * dailyKcal;
  };

  const handleAddMeal = () => {
    if (!newMealName.trim()) return;
    addMeal(weekNumber, day.dayOfWeek, {
      mealId: crypto.randomUUID(),
      name: newMealName.trim(),
      order: day.meals.length + 1,
      foods: [],
    });
    setNewMealName('');
    setShowAddMeal(false);
  };

  const handleCreateMealAndAddFood = (mealName: string, action: 'food' | 'recipe') => {
    const mealId = crypto.randomUUID();
    addMeal(weekNumber, day.dayOfWeek, {
      mealId,
      name: mealName,
      order: day.meals.length + 1,
      foods: [],
    });
    // After creating the meal, set the appropriate search state via a small trick:
    // We store the pending action so the newly rendered MealCard can pick it up.
    // Since we can't directly trigger state inside MealCard, we just create the meal
    // and let the user click the button themselves. A UX improvement can be done later.
    void action; // meal is created; user can now interact with it
  };

  const sortedMeals = day.meals.slice().sort((a, b) => a.order - b.order);

  return (
    <div
      className={`flex w-[280px] shrink-0 flex-col rounded-sm border bg-surface transition-colors ${
        isDragOver ? 'border-gold' : 'border-border'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        onDayDragOver(day.dayOfWeek);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDayDrop(day.dayOfWeek);
      }}
    >
      {/* Day header — drag handle for day reordering */}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          onDayDragStart(day.dayOfWeek);
        }}
        className="cursor-grab border-b border-border px-3 py-2.5 active:cursor-grabbing"
      >
        <div className="flex items-center justify-between">
          <span className="font-heading text-xs font-bold uppercase tracking-wide">
            {dayLabel}
          </span>
          <span className={`text-xs font-medium ${isOverTarget ? 'text-red-400' : 'text-green-400'}`}>
            {dayKcal} kcal
          </span>
        </div>

        {/* Day macro totals */}
        <div className="flex justify-center gap-2 mt-1.5 mb-2.5 pb-2 border-b border-border">
          <span className="text-[10px] font-semibold text-gold">{dayTotals.kcal} kcal</span>
          <span className="text-[10px] text-blue-400">P {dayTotals.protein}g</span>
          <span className="text-[10px] text-amber-400">C {dayTotals.carbs}g</span>
          <span className="text-[10px] text-rose-400">F {dayTotals.fat}g</span>
        </div>

        {isOverTarget && (
          <div className="mt-1 text-[10px] font-semibold text-red-400">
            {t('nutrition.overTarget')}
          </div>
        )}

        {/* Macro progress bars */}
        {hasTargets && (
          <div className="mt-2 flex flex-col gap-1.5">
            {globalSettings.dailyKcal != null && globalSettings.dailyKcal > 0 && (
              <MacroProgressBar
                label="kcal"
                current={day.dayTotals?.kcal ?? 0}
                target={globalSettings.dailyKcal}
                color="kcal"
              />
            )}
            {globalSettings.proteinGrams != null && globalSettings.proteinGrams > 0 && (
              <MacroProgressBar
                label={t('foods.protein')}
                current={day.dayTotals?.protein ?? 0}
                target={globalSettings.proteinGrams}
                color="protein"
              />
            )}
            {globalSettings.carbsGrams != null && globalSettings.carbsGrams > 0 && (
              <MacroProgressBar
                label={t('foods.carbs')}
                current={day.dayTotals?.carbs ?? 0}
                target={globalSettings.carbsGrams}
                color="carbs"
              />
            )}
            {globalSettings.fatGrams != null && globalSettings.fatGrams > 0 && (
              <MacroProgressBar
                label={t('foods.fat')}
                current={day.dayTotals?.fat ?? 0}
                target={globalSettings.fatGrams}
                color="fat"
              />
            )}
          </div>
        )}
      </div>

      {/* Meals */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {sortedMeals.length === 0 && distributionEntries.length === 0 && (
          <div className="py-6 text-center text-xs text-text3">{t('nutrition.noMeals')}</div>
        )}

        {/* Render distribution-based meal sections: real meals where they exist, placeholders where they don't */}
        {distributionEntries.length > 0
          ? distributionEntries.map(([mealName, pct]) => {
              const target = dailyKcal != null && dailyKcal > 0 ? Math.round((pct / 100) * dailyKcal) : null;
              const existingMeal = sortedMeals.find(
                (m) => m.name.toLowerCase() === mealName.toLowerCase(),
              );

              if (existingMeal) {
                const idx = sortedMeals.indexOf(existingMeal);
                return (
                  <SortableMealCard
                    key={existingMeal.mealId}
                    meal={existingMeal}
                    weekNumber={weekNumber}
                    dayOfWeek={day.dayOfWeek}
                    index={idx}
                    targetKcal={target}
                  />
                );
              }

              // Placeholder for a meal that doesn't exist yet
              return (
                <div key={mealName} className="rounded-sm border border-border bg-[#1a1a1a]">
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <span className="flex-1 text-sm font-semibold text-text">{mealName}</span>
                    {target != null && (
                      <span className="text-[9px] text-muted">target {target}</span>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <div className="mb-2 text-xs italic text-text3">{t('nutrition.noFoods', 'No foods added')}</div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleCreateMealAndAddFood(mealName, 'food')}
                        className="text-xs font-semibold text-gold-dim transition-colors hover:text-gold"
                      >
                        + {t('nutrition.addFood')}
                      </button>
                      <button
                        onClick={() => handleCreateMealAndAddFood(mealName, 'recipe')}
                        className="text-xs font-semibold text-gold-dim transition-colors hover:text-gold"
                      >
                        + {t('recipes.fromRecipe', 'From Recipe')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          : sortedMeals.map((meal, idx) => (
              <SortableMealCard
                key={meal.mealId}
                meal={meal}
                weekNumber={weekNumber}
                dayOfWeek={day.dayOfWeek}
                index={idx}
                targetKcal={getMealTargetKcal(meal.name)}
              />
            ))
        }

        {/* Also render any meals that don't match distribution names (manually added) */}
        {distributionEntries.length > 0 &&
          sortedMeals
            .filter((m) => !distributionEntries.some(([name]) => name.toLowerCase() === m.name.toLowerCase()))
            .map((meal, idx) => (
              <SortableMealCard
                key={meal.mealId}
                meal={meal}
                weekNumber={weekNumber}
                dayOfWeek={day.dayOfWeek}
                index={sortedMeals.indexOf(meal)}
                targetKcal={null}
              />
            ))
        }

        {/* Add meal */}
        {showAddMeal ? (
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={newMealName}
              onChange={(e) => setNewMealName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMeal()}
              placeholder={t('nutrition.mealNamePlaceholder')}
              className="flex-1 rounded-sm border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-gold/40"
            />
            <button
              onClick={handleAddMeal}
              className="rounded-sm bg-gold px-2 py-1.5 text-[10px] font-bold text-black"
            >
              +
            </button>
            <button
              onClick={() => {
                setShowAddMeal(false);
                setNewMealName('');
              }}
              className="rounded-sm border border-border px-2 py-1.5 text-[10px] text-text3"
            >
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddMeal(true)}
            className="py-1 text-xs font-semibold text-gold-dim transition-colors hover:text-gold"
          >
            {t('nutrition.addMeal')}
          </button>
        )}
      </div>
    </div>
  );
}

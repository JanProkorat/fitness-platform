import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/react/sortable';
import { useNutritionPlanStore } from '@/stores/nutritionPlan';
import type { PlanDay, PlanMeal, MealFood, GlobalNutritionSettings, MealLogDto } from '@/api/plan-types';
import MacroProgressBar from './MacroProgressBar';
import MealCard from './MealCard';
import AddItemsDrawer from './AddItemsDrawer';
import DraggableDayHeader from '@/components/training/DraggableDayHeader';
import { MEAL_KINDS, type MealKind } from './meal-kind';
import { CompletionBadge } from '@/components/training/CompletionBadge';
import { deriveMealCompletionState, deriveDayCompletionState } from '@/lib/completionState';

interface DayColumnProps {
  day: PlanDay;
  weekNumber: number;
  dayLabel: string;
  globalSettings?: GlobalNutritionSettings | null;
  mealDistribution?: Record<string, number> | null;
  dailyKcal?: number | null;
  /// When true, the day header becomes a draggable handle for day reorder/copy.
  draggable?: boolean;
  /** Meal log data from the plan response — used to derive eaten state. */
  mealLogs?: MealLogDto[];
}

function SortableMealCard({
  meal,
  weekNumber,
  dayOfWeek,
  index,
  targetKcal,
  locked,
  completionState,
}: {
  meal: PlanMeal;
  weekNumber: number;
  dayOfWeek: number;
  index: number;
  targetKcal?: number | null;
  locked?: boolean;
  completionState?: 'eaten' | 'not-touched';
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
      className="flex flex-1 flex-col"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <MealCard
        meal={meal}
        weekNumber={weekNumber}
        dayOfWeek={dayOfWeek}
        targetKcal={targetKcal}
        locked={locked}
        completionState={completionState}
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
  draggable: isDraggable,
  mealLogs,
}: DayColumnProps) {
  const { t } = useTranslation();
  const addMeal = useNutritionPlanStore((s) => s.addMeal);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [newMealKind, setNewMealKind] = useState<MealKind>('Breakfast');

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
    fiber: Math.round(day.dayTotals?.fiber ?? 0),
  };

  // Distribution entries with non-zero percentages
  const distributionEntries = mealDistribution
    ? Object.entries(mealDistribution).filter(([, pct]) => pct > 0)
    : [];

  // Map distribution keys (e.g. "breakfast") to localized labels
  const getMealLabel = (key: string): string => {
    const i18nKey = `nutritionGoals.${key}`;
    const translated = t(i18nKey);
    // If the key wasn't found, t() returns the key itself — fall back to raw key
    return translated === i18nKey ? key : translated;
  };

  // Compute per-meal target kcal from distribution (match by key or localized label)
  const getMealTargetKcal = (mealName: string): number | null => {
    if (!mealDistribution || dailyKcal == null || dailyKcal <= 0) return null;
    // Direct key match
    const pct = mealDistribution[mealName];
    if (pct != null) return (pct / 100) * dailyKcal;
    // Try matching by localized label
    const lower = mealName.toLowerCase();
    const entry = Object.entries(mealDistribution).find(
      ([key]) => getMealLabel(key).toLowerCase() === lower,
    );
    if (entry) return (entry[1] / 100) * dailyKcal;
    return null;
  };

  const handleAddMeal = () => {
    addMeal(weekNumber, day.dayOfWeek, {
      mealId: crypto.randomUUID(),
      kind: newMealKind,
      order: day.meals.length + 1,
      foods: [],
    });
    setNewMealKind('Breakfast');
    setShowAddMeal(false);
  };

  // Drawer state for adding items to a placeholder meal
  const [placeholderDrawerKey, setPlaceholderDrawerKey] = useState<string | null>(null);

  const handlePlaceholderAddItems = (mealKey: string, items: MealFood[]) => {
    const mealId = crypto.randomUUID();
    addMeal(weekNumber, day.dayOfWeek, {
      mealId,
      kind: mealKey,
      order: day.meals.length + 1,
      foods: [],
    });
    // Add all items to the newly created meal
    const addFoodToMeal = useNutritionPlanStore.getState().addFoodToMeal;
    for (const item of items) {
      addFoodToMeal(weekNumber, day.dayOfWeek, mealId, item);
    }
  };

  const sortedMeals = day.meals.slice().sort((a, b) => a.order - b.order);

  // Derive day-level and per-meal eaten states from MealLog data
  const mealIdList = sortedMeals.map((m) => m.mealId);
  const { state: dayState, counts: dayCounts } = deriveDayCompletionState(mealLogs, mealIdList);

  return (
    <div className="flex w-[336px] shrink-0 flex-1 flex-col rounded-sm border border-border bg-bg2 transition-colors">
      {/* Day header — optionally a drag handle */}
      {isDraggable ? (
      <DraggableDayHeader weekNumber={weekNumber} dayOfWeek={day.dayOfWeek}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide">
            {dayLabel}
          </span>
          <div className="flex items-center gap-1.5">
            <CompletionBadge kind="day" state={dayState} counts={dayCounts} />
            <span className={`text-xs font-medium ${isOverTarget ? 'text-red-400' : 'text-green-400'}`}>
              {dayKcal} kcal
            </span>
          </div>
        </div>
      </DraggableDayHeader>
      ) : (
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide">
            {dayLabel}
          </span>
          <div className="flex items-center gap-1.5">
            <CompletionBadge kind="day" state={dayState} counts={dayCounts} />
            <span className={`text-xs font-medium ${isOverTarget ? 'text-red-400' : 'text-green-400'}`}>
              {dayKcal} kcal
            </span>
          </div>
        </div>
      </div>
      )}

      <div className="px-3 py-2.5">
        {/* Day macro totals */}
        <div className="flex justify-center gap-2 mb-2.5 pb-2 border-b border-border">
          <span className="text-[10px] font-semibold text-accent">{dayTotals.kcal} kcal</span>
          <span className="text-[10px] text-blue-400">P {dayTotals.protein}g</span>
          <span className="text-[10px] text-amber-400">C {dayTotals.carbs}g</span>
          <span className="text-[10px] text-rose-400">F {dayTotals.fat}g</span>
          <span className="text-[10px] text-green-400">Fi {dayTotals.fiber}g</span>
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
            {globalSettings.fiberGrams != null && globalSettings.fiberGrams > 0 && (
              <MacroProgressBar
                label={t('foods.fiber')}
                current={day.dayTotals?.fiber ?? 0}
                target={globalSettings.fiberGrams}
                color="fiber"
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
              const label = getMealLabel(mealName).toLowerCase();
              const existingMeal = sortedMeals.find(
                (m) => {
                  const k = m.kind.toLowerCase();
                  return k === mealName.toLowerCase() || k === label;
                },
              );

              if (existingMeal) {
                const idx = sortedMeals.indexOf(existingMeal);
                const mealState = deriveMealCompletionState(mealLogs, existingMeal.mealId);
                return (
                  <SortableMealCard
                    key={existingMeal.mealId}
                    meal={existingMeal}
                    weekNumber={weekNumber}
                    dayOfWeek={day.dayOfWeek}
                    index={idx}
                    targetKcal={target}
                    locked={mealState === 'eaten'}
                    completionState={mealState}
                  />
                );
              }

              // Placeholder for a meal that doesn't exist yet
              return (
                <div key={mealName} className="flex flex-1 flex-col rounded-sm border border-border bg-bg2">
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <span className="flex-1 text-sm font-semibold text-text">{getMealLabel(mealName)}</span>
                    {target != null && (
                      <span className="text-[9px] text-text3">target {target}</span>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <div className="mb-2 text-xs italic text-text3">{t('nutrition.noFoods', 'No foods added')}</div>
                    <button
                      onClick={() => setPlaceholderDrawerKey(mealName)}
                      className="w-full rounded-sm border border-border bg-bg3 py-1.5 text-[9px] font-semibold uppercase text-text3 transition-colors hover:text-accent"
                    >
                      + {t('nutrition.addItems', 'Add Items')}
                    </button>
                    <AddItemsDrawer
                      open={placeholderDrawerKey === mealName}
                      onClose={() => setPlaceholderDrawerKey(null)}
                      onAdd={(items) => handlePlaceholderAddItems(mealName, items)}
                    />
                  </div>
                </div>
              );
            })
          : sortedMeals.map((meal, idx) => {
              const mealState = deriveMealCompletionState(mealLogs, meal.mealId);
              return (
                <SortableMealCard
                  key={meal.mealId}
                  meal={meal}
                  weekNumber={weekNumber}
                  dayOfWeek={day.dayOfWeek}
                  index={idx}
                  targetKcal={getMealTargetKcal(meal.kind)}
                  locked={mealState === 'eaten'}
                  completionState={mealState}
                />
              );
            })
        }

        {/* Also render any meals that don't match distribution names (manually added) */}
        {distributionEntries.length > 0 &&
          sortedMeals
            .filter((m) => !distributionEntries.some(([key]) => {
              const k = m.kind.toLowerCase();
              return k === key.toLowerCase() || k === getMealLabel(key).toLowerCase();
            }))
            .map((meal) => {
              const mealState = deriveMealCompletionState(mealLogs, meal.mealId);
              return (
                <SortableMealCard
                  key={meal.mealId}
                  meal={meal}
                  weekNumber={weekNumber}
                  dayOfWeek={day.dayOfWeek}
                  index={sortedMeals.indexOf(meal)}
                  targetKcal={null}
                  locked={mealState === 'eaten'}
                  completionState={mealState}
                />
              );
            })
        }

        {/* Add meal */}
        {showAddMeal ? (
          <div className="flex gap-1.5">
            <select
              value={newMealKind}
              onChange={(e) => setNewMealKind(e.target.value as MealKind)}
              className="form-select flex-1 rounded-sm border border-border bg-bg2 px-2 py-1.5 text-xs text-text outline-none focus:border-border-hv"
            >
              {MEAL_KINDS.map((k) => (
                <option key={k} value={k}>{t(`mealKind.${k}`)}</option>
              ))}
            </select>
            <button
              onClick={handleAddMeal}
              className="rounded-sm bg-accent px-2 py-1.5 text-[10px] font-bold text-bg"
            >
              +
            </button>
            <button
              onClick={() => {
                setShowAddMeal(false);
                setNewMealKind('Breakfast');
              }}
              className="rounded-sm border border-border px-2 py-1.5 text-[10px] text-text3"
            >
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddMeal(true)}
            className="py-1 text-xs font-semibold text-accent transition-colors hover:text-accent"
          >
            {t('nutrition.addMeal')}
          </button>
        )}
      </div>
    </div>
  );
}

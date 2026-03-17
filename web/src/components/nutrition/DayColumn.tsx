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
}: {
  meal: PlanMeal;
  weekNumber: number;
  dayOfWeek: number;
  index: number;
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
      />
    </div>
  );
}

export default function DayColumn({
  day,
  weekNumber,
  dayLabel,
  globalSettings,
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
        {sortedMeals.length === 0 && (
          <div className="py-6 text-center text-xs text-text3">{t('nutrition.noMeals')}</div>
        )}

        {sortedMeals.map((meal, idx) => (
          <SortableMealCard
            key={meal.mealId}
            meal={meal}
            weekNumber={weekNumber}
            dayOfWeek={day.dayOfWeek}
            index={idx}
          />
        ))}

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

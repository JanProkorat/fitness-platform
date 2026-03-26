import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface MealDistributionProps {
  totalKcal: number;
  macroTargets: {
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  };
  initialDistribution?: Record<string, number> | null;
  onChange?: (distribution: Record<string, number>) => void;
}

interface Meal {
  key: string;
  i18nKey: string;
  percent: number;
}

const DEFAULT_MEALS: Meal[] = [
  { key: 'breakfast', i18nKey: 'nutritionGoals.breakfast', percent: 25 },
  { key: 'snack1', i18nKey: 'nutritionGoals.snack1', percent: 10 },
  { key: 'lunch', i18nKey: 'nutritionGoals.lunch', percent: 30 },
  { key: 'snack2', i18nKey: 'nutritionGoals.snack2', percent: 10 },
  { key: 'dinner', i18nKey: 'nutritionGoals.dinner', percent: 25 },
];

export default function MealDistribution({
  totalKcal,
  macroTargets,
  initialDistribution,
  onChange,
}: MealDistributionProps) {
  const { t } = useTranslation();
  const [meals, setMeals] = useState<Meal[]>(() => {
    if (initialDistribution) {
      return DEFAULT_MEALS.map(m => ({
        ...m,
        percent: initialDistribution[m.key] ?? m.percent,
      }));
    }
    return DEFAULT_MEALS;
  });

  const handleChange = useCallback(
    (index: number, value: number) => {
      setMeals((prev) => {
        const updated = [...prev];
        const oldValue = updated[index].percent;
        const delta = value - oldValue;
        updated[index] = { ...updated[index], percent: value };

        // Proportionally adjust other meals
        const otherIndices = prev
          .map((_, i) => i)
          .filter((i) => i !== index);
        const otherTotal = otherIndices.reduce(
          (sum, i) => sum + prev[i].percent,
          0,
        );

        if (otherTotal > 0) {
          let remaining = 100 - value;
          for (let j = 0; j < otherIndices.length; j++) {
            const i = otherIndices[j];
            if (j === otherIndices.length - 1) {
              // Last one gets the remainder
              updated[i] = { ...updated[i], percent: Math.max(0, remaining) };
            } else {
              const newPct = Math.max(
                0,
                Math.round(prev[i].percent - (delta * prev[i].percent) / otherTotal),
              );
              updated[i] = { ...updated[i], percent: newPct };
              remaining -= newPct;
            }
          }
        }

        if (onChange) {
          const dist: Record<string, number> = {};
          updated.forEach(m => { dist[m.key] = m.percent; });
          onChange(dist);
        }

        return updated;
      });
    },
    [onChange],
  );

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-gold">
        {t('nutritionGoals.mealDistribution')}
      </h2>

      <div className="space-y-3">
        {meals.map((meal, index) => {
          const mealKcal = Math.round((totalKcal * meal.percent) / 100);
          const mealProtein = Math.round(
            (macroTargets.proteinGrams * meal.percent) / 100,
          );
          const mealCarbs = Math.round(
            (macroTargets.carbsGrams * meal.percent) / 100,
          );
          const mealFat = Math.round(
            (macroTargets.fatGrams * meal.percent) / 100,
          );

          return (
            <div
              key={meal.key}
              className="rounded-sm border border-border bg-surface p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text">
                  {t(meal.i18nKey)}
                </span>
                <span className="font-mono text-sm text-gold">
                  {mealKcal} kcal
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={meal.percent}
                  onChange={(e) =>
                    handleChange(index, parseInt(e.target.value, 10))
                  }
                  className="flex-1 accent-gold"
                />
                <span className="w-10 text-right font-mono text-xs text-muted">
                  {meal.percent}%
                </span>
              </div>
              <div className="mt-1 flex gap-4 text-[11px] text-muted">
                <span>
                  <span className="text-blue-400">{t('nutritionGoals.proteinShort')}</span> {mealProtein}
                  {t('nutritionGoals.grams')}
                </span>
                <span>
                  <span className="text-amber-400">{t('nutritionGoals.carbsShort')}</span> {mealCarbs}
                  {t('nutritionGoals.grams')}
                </span>
                <span>
                  <span className="text-rose-400">{t('nutritionGoals.fatShort')}</span> {mealFat}
                  {t('nutritionGoals.grams')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

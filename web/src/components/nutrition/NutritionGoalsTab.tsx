import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getClientDashboard } from '@/api/nutrition-goals';
import MacroSliders from '@/components/nutrition/MacroSliders';
import MealDistribution from '@/components/nutrition/MealDistribution';

/** Props for the NutritionGoalsTab component. */
interface NutritionGoalsTabProps {
  /** The public ID of the client whose nutrition goals are displayed. */
  clientId: string;
}

/**
 * Read-only display of a client's nutrition goals.
 *
 * Fetches the client dashboard on mount and renders BMR/TDEE/Adjusted Kcal
 * flow, macro targets, macro sliders, and meal distribution — all in a
 * non-interactive (pointer-events-none) mode.
 */
export default function NutritionGoalsTab({ clientId }: NutritionGoalsTabProps) {
  const { t } = useTranslation();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client-dashboard', clientId],
    queryFn: () => getClientDashboard(clientId),
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-text3">
        {t('common.loading', 'Loading…')}
      </div>
    );
  }

  const ob = client?.onboarding;

  if (!ob || ob.bmr == null) {
    return (
      <p className="text-center text-sm text-text3">
        {t('nutrition.noNutritionGoals')}
      </p>
    );
  }

  /** Translate an enum/tag value via clients.values.X, fall back to raw value. */
  const v = (val: string | null | undefined): string => {
    if (!val) return '\u2014';
    const key = `clients.values.${val}`;
    const translated = t(key);
    return translated !== key ? translated : val;
  };

  // Derive macro percentages from stored grams + kcal for the sliders.
  // Protein: 4 kcal/g, Carbs: 4 kcal/g, Fat: 9 kcal/g.
  const adjustedKcal = ob.adjustedKcal ?? 0;
  const proteinKcal = (ob.proteinGrams ?? 0) * 4;
  const carbsKcal = (ob.carbsGrams ?? 0) * 4;
  const fatKcal = (ob.fatGrams ?? 0) * 9;
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal || 1;
  const proteinPercent = Math.round((proteinKcal / totalMacroKcal) * 100);
  const carbsPercent = Math.round((carbsKcal / totalMacroKcal) * 100);
  const fatPercent = 100 - proteinPercent - carbsPercent;

  const macroTargets = {
    dailyKcal: adjustedKcal,
    proteinGrams: ob.proteinGrams ?? 0,
    carbsGrams: ob.carbsGrams ?? 0,
    fatGrams: ob.fatGrams ?? 0,
  };

  const mealDistribution = ob.mealDistribution
    ? (() => {
        try {
          return JSON.parse(ob.mealDistribution) as Record<string, number>;
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Nutrition Targets */}
      <div className="rounded-sm border border-border bg-bg2 p-5">
        {/* BMR -> TDEE -> Adjusted flow */}
        <div className="mb-4 flex items-center gap-3 text-sm">
          <div className="rounded bg-accent-bg px-3 py-2 text-center">
            <span className="text-xs text-text3">BMR</span>
            <p className="font-bold text-accent">{ob.bmr} kcal</p>
          </div>
          <span className="text-text3">&rarr;</span>
          <div className="rounded bg-accent-bg px-3 py-2 text-center">
            <span className="text-xs text-text3">TDEE</span>
            <p className="font-bold text-accent">{ob.tdee} kcal</p>
          </div>
          <span className="text-text3">&rarr;</span>
          <div className="rounded bg-accent-bg px-3 py-2 text-center">
            <span className="text-xs text-text3">{t('clients.adjustedKcal')}</span>
            <p className="font-bold text-accent">{ob.adjustedKcal} kcal</p>
          </div>
        </div>

        {/* Activity level and nutrition goal */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {ob.derivedActivityLevel && (
            <div>
              <span className="text-xs text-text3">{t('clients.derivedActivity')}</span>
              <p className="font-medium">{v(ob.derivedActivityLevel)}</p>
            </div>
          )}
          {ob.derivedNutritionGoal && (
            <div>
              <span className="text-xs text-text3">{t('clients.derivedGoal')}</span>
              <p className="font-medium">{v(ob.derivedNutritionGoal)}</p>
            </div>
          )}
        </div>

        {/* Macro targets */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div className="rounded bg-blue-500/10 px-3 py-3">
            <span className="text-xs text-blue-400">{t('clients.protein')}</span>
            <p className="text-lg font-bold text-blue-400">{ob.proteinGrams}g</p>
          </div>
          <div className="rounded bg-amber-500/10 px-3 py-3">
            <span className="text-xs text-amber-400">{t('clients.carbs')}</span>
            <p className="text-lg font-bold text-amber-400">{ob.carbsGrams}g</p>
          </div>
          <div className="rounded bg-rose-500/10 px-3 py-3">
            <span className="text-xs text-rose-400">{t('clients.fat')}</span>
            <p className="text-lg font-bold text-rose-400">{ob.fatGrams}g</p>
          </div>
        </div>
      </div>

      {/* MacroSliders — read-only */}
      {adjustedKcal > 0 && (
        <div className="rounded-sm border border-border bg-bg2 p-5">
          <div className="pointer-events-none">
            <MacroSliders
              proteinPercent={proteinPercent}
              carbsPercent={carbsPercent}
              fatPercent={fatPercent}
              totalKcal={adjustedKcal}
              onChange={() => {}}
            />
          </div>
        </div>
      )}

      {/* MealDistribution — read-only */}
      {adjustedKcal > 0 && (
        <div className="rounded-sm border border-border bg-bg2 p-5">
          <div className="pointer-events-none">
            <MealDistribution
              totalKcal={adjustedKcal}
              macroTargets={macroTargets}
              initialDistribution={mealDistribution}
            />
          </div>
        </div>
      )}
    </div>
  );
}

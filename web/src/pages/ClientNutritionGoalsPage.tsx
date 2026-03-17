import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import AnamnesisForm from '@/components/nutrition/AnamnesisForm';
import GoalCalculation from '@/components/nutrition/GoalCalculation';
import MacroSliders from '@/components/nutrition/MacroSliders';
import MealDistribution from '@/components/nutrition/MealDistribution';
import {
  calculateGoals,
  getClientDashboard,
  type CalculateGoalsResponse,
  type CalculateGoalsRequest,
} from '@/api/nutrition-goals';
import type { AnamnesisData } from '@/components/nutrition/AnamnesisForm';

export default function ClientNutritionGoalsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<CalculateGoalsResponse | null>(null);
  const [lastRequest, setLastRequest] = useState<AnamnesisData | null>(null);
  const [macros, setMacros] = useState({
    protein: 30,
    carbs: 45,
    fat: 25,
  });

  const { data: client } = useQuery({
    queryKey: ['client-dashboard', id],
    queryFn: () => getClientDashboard(id!),
    enabled: !!id,
  });

  const clientName = client
    ? `${client.firstName} ${client.lastName}`
    : '...';

  const handleCalculate = async (data: AnamnesisData) => {
    if (!id) return;
    setIsCalculating(true);
    try {
      const request: CalculateGoalsRequest = {
        ...data,
        proteinPercent: macros.protein,
        carbsPercent: macros.carbs,
        fatPercent: macros.fat,
      };
      const response = await calculateGoals(id, request);
      setResult(response);
      setLastRequest(data);
    } catch {
      // Error is handled by the API interceptor
    } finally {
      setIsCalculating(false);
    }
  };

  const handleMacroChange = async (
    protein: number,
    carbs: number,
    fat: number,
  ) => {
    setMacros({ protein, carbs, fat });

    // Recalculate with new macro percentages if we have previous request data
    if (lastRequest && id) {
      try {
        const request: CalculateGoalsRequest = {
          ...lastRequest,
          proteinPercent: protein,
          carbsPercent: carbs,
          fatPercent: fat,
        };
        const response = await calculateGoals(id, request);
        setResult(response);
      } catch {
        // Silently fail on recalculation
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-border bg-[#111111] px-6 py-4">
        <Link
          to={`/clients/${id}`}
          className="font-heading text-xs font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
        >
          &larr; {t('clients.backToClients')}
        </Link>
        <div className="h-4 w-px bg-border" />
        <Link
          to={`/clients/${id}`}
          className="font-heading text-xs font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
        >
          {clientName}
        </Link>
        <div className="h-4 w-px bg-border" />
        <div>
          <h1 className="text-lg font-bold">{t('nutritionGoals.title')}</h1>
          <p className="text-xs text-muted">
            {t('nutritionGoals.subtitle')}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Section 1: Anamnesis Form */}
          <div className="rounded-sm border border-border bg-surface p-5">
            <AnamnesisForm
              client={client}
              onSubmit={handleCalculate}
              isLoading={isCalculating}
            />
          </div>

          {/* Section 2: Calculation Results */}
          {result && lastRequest && (
            <div className="rounded-sm border border-border bg-surface p-5">
              <GoalCalculation
                bmr={result.bmr}
                tdee={result.tdee}
                adjustedKcal={result.adjustedKcal}
                activityLevel={lastRequest.activityLevel}
                goal={lastRequest.goal}
              />
            </div>
          )}

          {/* Section 3: Macro Sliders */}
          {result && (
            <div className="rounded-sm border border-border bg-surface p-5">
              <MacroSliders
                proteinPercent={macros.protein}
                carbsPercent={macros.carbs}
                fatPercent={macros.fat}
                totalKcal={result.adjustedKcal}
                onChange={handleMacroChange}
              />
            </div>
          )}

          {/* Section 4: Meal Distribution */}
          {result && (
            <div className="rounded-sm border border-border bg-surface p-5">
              <MealDistribution
                totalKcal={result.adjustedKcal}
                macroTargets={result.macroTargets}
              />
            </div>
          )}

          {/* Apply to Plan button */}
          {result && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled
                className="rounded-sm bg-gold/30 px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black/40 cursor-not-allowed"
              >
                {t('nutritionGoals.applyToPlan')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui';
import { PropertyList } from '@/components/data';
import { AnamnesisSectionPanel } from '@/components/nutrition/AnamnesisSectionPanel';
import { GoalsMacroPanel } from '@/components/nutrition/GoalsMacroPanel';
import {
  calculateGoals,
  getClientDashboard,
  updateClientData,
  type CalculateGoalsRequest,
  type CalculateGoalsResponse,
} from '@/api/nutrition-goals';

/** Matches the sliders' own 5% floor — see GoalsMacroPanel.tsx `min={5}`. */
const MACRO_DISTRIBUTION_FLOOR_PERCENT = 5;

/**
 * Redistributes the remainder (100 - changedValue) between the two macros
 * that were NOT directly edited, proportionally to their current split.
 *
 * Defensive against:
 *   - divide-by-zero / near-zero remainder when `otherA + otherB` collapses
 *     to (near) 0 — falls back to an even split of the remainder.
 *   - either result dropping below the sliders' 5% floor (GoalsMacroPanel
 *     enforces `min={5}` on drag; a purely computed redistribution has no
 *     such guard and can otherwise land below it, or at NaN).
 *
 * Returns `[newA, newB]`, both clamped to >= 5, summing to
 * `100 - changedValue` whenever that remainder is itself >= 10 (guaranteed
 * by the sliders' own floor on `changedValue`).
 */
function redistributeRemainder(
  changedValue: number,
  otherA: number,
  otherB: number,
): [number, number] {
  const remainder = 100 - changedValue;
  const denom = otherA + otherB;
  const newA =
    denom > MACRO_DISTRIBUTION_FLOOR_PERCENT / 100
      ? Math.round((remainder * otherA) / denom)
      : Math.round(remainder / 2);
  const clampedA = Math.max(MACRO_DISTRIBUTION_FLOOR_PERCENT, newA);
  const clampedB = Math.max(MACRO_DISTRIBUTION_FLOOR_PERCENT, remainder - clampedA);
  return [clampedA, clampedB];
}

const TRAINING_FREQ_KEYS: Record<string, string> = {
  None: 'nutritionGoals.trainingFreq_None',
  Occasional: 'nutritionGoals.trainingFreq_Occasional',
  Regular: 'nutritionGoals.trainingFreq_Regular',
  High: 'nutritionGoals.trainingFreq_High',
};

const DESIRED_FREQ_KEYS: Record<string, string> = {
  TwoPerWeek: 'nutritionGoals.desiredFreq_TwoPerWeek',
  ThreePerWeek: 'nutritionGoals.desiredFreq_ThreePerWeek',
  FourPerWeek: 'nutritionGoals.desiredFreq_FourPerWeek',
  FivePerWeek: 'nutritionGoals.desiredFreq_FivePerWeek',
};

const BODY_TYPE_KEYS: Record<string, string> = {
  Ectomorph: 'nutritionGoals.bodyType_Ectomorph',
  Mesomorph: 'nutritionGoals.bodyType_Mesomorph',
  Endomorph: 'nutritionGoals.bodyType_Endomorph',
};

const PRIMARY_GOAL_KEYS: Record<string, string> = {
  LoseFat: 'nutritionGoals.goal_LoseFat',
  GainMuscle: 'nutritionGoals.goal_GainMuscle',
  Recomposition: 'nutritionGoals.goal_Recomposition',
  Fitness: 'nutritionGoals.goal_Fitness',
  Health: 'nutritionGoals.goal_Health',
};

const MOTIVATION_KEYS: Record<string, string> = {
  Appearance: 'nutritionGoals.motivation_Appearance',
  Health: 'nutritionGoals.motivation_Health',
  Performance: 'nutritionGoals.motivation_Performance',
  Confidence: 'nutritionGoals.motivation_Confidence',
};

const ACTIVITY_ITEM_KEYS: Record<string, string> = {
  strength: 'nutritionGoals.activity_strength',
  cardio: 'nutritionGoals.activity_cardio',
  hiit: 'nutritionGoals.activity_hiit',
  yoga: 'nutritionGoals.activity_yoga',
  cycling: 'nutritionGoals.activity_cycling',
  martial_arts: 'nutritionGoals.activity_martial_arts',
};

export default function ClientNutritionGoalsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const user = useAuthStore((s) => s.user);
  const isTrainer = user?.roles?.includes('Trainer') || user?.roles?.includes('Admin');
  const isNutritionist = user?.roles?.includes('Nutritionist') || user?.roles?.includes('Admin');

  const { data: client } = useQuery({
    queryKey: ['client-dashboard', id],
    queryFn: () => getClientDashboard(id!),
    enabled: !!id,
  });

  const clientName = client
    ? `${client.firstName} ${client.lastName}`
    : '...';

  // Editable anamnesis fields
  const [age, setAge] = useState<number>(0);
  const [sex, setSex] = useState<'Male' | 'Female'>('Female');
  const [heightCm, setHeightCm] = useState<number>(0);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [targetWeight, setTargetWeight] = useState<number>(0);
  const [activityLevel, setActivityLevel] = useState<CalculateGoalsRequest['activityLevel']>('ModeratelyActive');
  const [goal, setGoal] = useState<CalculateGoalsRequest['goal']>('Cut');

  // Macro state
  const [proteinPercent, setProteinPercent] = useState(30);
  const [carbsPercent, setCarbsPercent] = useState(45);
  const [fatPercent, setFatPercent] = useState(25);

  const [result, setResult] = useState<CalculateGoalsResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize from client data once loaded
  if (client && !initialized) {
    const ob = client.onboarding;
    setAge(ob?.bmr ? Math.round((new Date().getFullYear()) - (client.dateOfBirth ? new Date(client.dateOfBirth).getFullYear() : 1996)) : 27);
    setSex((ob?.sex as 'Male' | 'Female') || 'Female');
    setHeightCm(client.heightCm || 168);
    setWeightKg(client.weightKg || 63);
    setTargetWeight(ob?.targetWeightKg || 58);
    setActivityLevel((ob?.derivedActivityLevel as CalculateGoalsRequest['activityLevel']) || 'ModeratelyActive');
    setGoal((ob?.derivedNutritionGoal as CalculateGoalsRequest['goal']) || 'Cut');
    if (ob?.adjustedKcal) {
      setResult({
        bmr: ob.bmr || 0,
        tdee: ob.tdee || 0,
        adjustedKcal: ob.adjustedKcal,
        macroTargets: {
          dailyKcal: ob.adjustedKcal,
          proteinGrams: ob.proteinGrams || 130,
          carbsGrams: ob.carbsGrams || 180,
          fatGrams: ob.fatGrams || 55,
          fiberGrams: ob.fiberGrams || 30,
        },
      });
    }
    setInitialized(true);
  }

  const recalculate = useCallback(async (overrides?: Partial<{ age: number; sex: 'Male' | 'Female'; heightCm: number; weightKg: number; activityLevel: CalculateGoalsRequest['activityLevel']; goal: CalculateGoalsRequest['goal']; pp: number; cp: number; fp: number }>) => {
    if (!id) return;
    setIsCalculating(true);
    try {
      const request: CalculateGoalsRequest = {
        age: overrides?.age ?? age,
        sex: overrides?.sex ?? sex,
        heightCm: overrides?.heightCm ?? heightCm,
        weightKg: overrides?.weightKg ?? weightKg,
        activityLevel: overrides?.activityLevel ?? activityLevel,
        goal: overrides?.goal ?? goal,
        proteinPercent: overrides?.pp ?? proteinPercent,
        carbsPercent: overrides?.cp ?? carbsPercent,
        fatPercent: overrides?.fp ?? fatPercent,
      };
      const response = await calculateGoals(id, request);
      setResult(response);
    } catch {
      // handled by interceptor
    } finally {
      setIsCalculating(false);
    }
  }, [id, age, sex, heightCm, weightKg, activityLevel, goal, proteinPercent, carbsPercent, fatPercent]);

  const handleSave = async () => {
    if (!id || !result) return;
    setSaving(true);
    try {
      await updateClientData(id, {
        weightKg,
        heightCm,
        age,
        sex,
        derivedActivityLevel: activityLevel,
        derivedNutritionGoal: goal,
        bmr: result.bmr,
        tdee: result.tdee,
        adjustedKcal: result.adjustedKcal,
        proteinGrams: result.macroTargets.proteinGrams,
        carbsGrams: result.macroTargets.carbsGrams,
        fatGrams: result.macroTargets.fatGrams,
      });
      // The BMR/TDEE/macro fields just saved are surfaced via the
      // ['client-dashboard', id] query (NutritionGoalsTab, NutritionPlanPage
      // meal-macro widgets). Without this invalidation those views keep
      // showing the pre-save goals until an unrelated refetch happens (#619).
      queryClient.invalidateQueries({ queryKey: ['client-dashboard', id] });
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  // Computed macros
  const kcal = result?.adjustedKcal ?? 0;
  const pGrams = result?.macroTargets.proteinGrams ?? 0;
  const cGrams = result?.macroTargets.carbsGrams ?? 0;
  const fGrams = result?.macroTargets.fatGrams ?? 0;
  const totalMacroCal = pGrams * 4 + cGrams * 4 + fGrams * 9;
  const pPct = totalMacroCal > 0 ? Math.round((pGrams * 4 / totalMacroCal) * 100) : 0;
  const cPct = totalMacroCal > 0 ? Math.round((cGrams * 4 / totalMacroCal) * 100) : 0;
  const fPct = totalMacroCal > 0 ? 100 - pPct - cPct : 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader
        icon="🎯"
        title={t('nutritionGoals.title')}
        subtitle={`${clientName} · ${t(isTrainer && isNutritionist ? 'nutritionGoals.subtitleBoth' : isNutritionist ? 'nutritionGoals.subtitle' : 'nutritionGoals.subtitleTrainer')}`}
        actions={
          <div className="flex gap-1.5">
            <Button onClick={() => window.history.back()}>
              &larr; {t('nutritionGoals.back')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!result || saving}
            >
              {saving ? t('nutritionGoals.savingChanges') : t('nutritionGoals.saveChanges')}
            </Button>
          </div>
        }
      />

      <div className="px-20 py-3">
        <div className="grid gap-8" style={{ gridTemplateColumns: isTrainer && isNutritionist ? '1fr 1fr 1fr' : '1fr 1fr' }}>
          {/* Left column - Anamneza */}
          <AnamnesisSectionPanel
            age={age}
            sex={sex}
            heightCm={heightCm}
            weightKg={weightKg}
            targetWeight={targetWeight}
            activityLevel={activityLevel}
            goal={goal}
            isCalculating={isCalculating}
            result={result}
            isNutritionist={isNutritionist}
            onAgeChange={(n) => {
              setAge(n);
              recalculate({ age: n });
            }}
            onSexChange={(s) => {
              setSex(s);
              recalculate({ sex: s });
            }}
            onHeightChange={(n) => {
              setHeightCm(n);
              recalculate({ heightCm: n });
            }}
            onWeightChange={(n) => {
              setWeightKg(n);
              recalculate({ weightKg: n });
            }}
            onTargetWeightChange={setTargetWeight}
            onActivityLevelChange={(al) => {
              setActivityLevel(al);
              recalculate({ activityLevel: al });
            }}
            onGoalChange={(g) => {
              setGoal(g);
              recalculate({ goal: g });
            }}
            onCalculate={() => recalculate()}
          />

          {/* Training profile column — visible to trainers */}
          {isTrainer && (
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text3 mb-2.5">
                {t('nutritionGoals.trainingProfile')}
              </div>
              <div className="bg-bg2 border border-border rounded-md p-2">
                <PropertyList
                  className="mb-0"
                  items={[
                    {
                      label: t('nutritionGoals.currentTrainingFrequency'),
                      icon: '🏋️',
                      value: client?.onboarding?.currentTrainingFrequency
                        ? t(TRAINING_FREQ_KEYS[client.onboarding.currentTrainingFrequency] ?? client.onboarding.currentTrainingFrequency)
                        : t('nutritionGoals.noData'),
                    },
                    {
                      label: t('nutritionGoals.desiredTrainingFrequency'),
                      icon: '📈',
                      value: client?.onboarding?.desiredTrainingFrequency
                        ? t(DESIRED_FREQ_KEYS[client.onboarding.desiredTrainingFrequency] ?? client.onboarding.desiredTrainingFrequency)
                        : t('nutritionGoals.noData'),
                    },
                    {
                      label: t('nutritionGoals.fitnessRating'),
                      icon: '💪',
                      value: client?.onboarding?.fitnessRating != null
                        ? t('nutritionGoals.fitnessRatingValue', { value: client.onboarding.fitnessRating })
                        : t('nutritionGoals.noData'),
                    },
                    {
                      label: t('nutritionGoals.preferredActivities'),
                      icon: '🎯',
                      value: client?.onboarding?.preferredActivities
                        ? client.onboarding.preferredActivities.split(',').map((a) => t(ACTIVITY_ITEM_KEYS[a.trim()] ?? a.trim())).join(', ')
                        : t('nutritionGoals.noData'),
                    },
                    {
                      label: t('nutritionGoals.injuries'),
                      icon: '🩹',
                      value: client?.onboarding?.injuries || t('nutritionGoals.noData'),
                    },
                    {
                      label: t('nutritionGoals.bodyType'),
                      icon: '🧍',
                      value: client?.onboarding?.bodyType
                        ? t(BODY_TYPE_KEYS[client.onboarding.bodyType] ?? client.onboarding.bodyType)
                        : t('nutritionGoals.noData'),
                    },
                    {
                      label: t('nutritionGoals.sleepHours'),
                      icon: '😴',
                      value: client?.onboarding?.sleepHours != null
                        ? t('nutritionGoals.sleepHoursValue', { value: client.onboarding.sleepHours })
                        : t('nutritionGoals.noData'),
                    },
                    {
                      label: t('nutritionGoals.stressLevel'),
                      icon: '🧠',
                      value: client?.onboarding?.stressLevel != null
                        ? t('nutritionGoals.stressLevelValue', { value: client.onboarding.stressLevel })
                        : t('nutritionGoals.noData'),
                    },
                    {
                      label: t('nutritionGoals.primaryGoal'),
                      icon: '🎯',
                      value: client?.onboarding?.primaryGoal
                        ? t(PRIMARY_GOAL_KEYS[client.onboarding.primaryGoal] ?? client.onboarding.primaryGoal)
                        : t('nutritionGoals.noData'),
                    },
                    {
                      label: t('nutritionGoals.primaryMotivation'),
                      icon: '🔥',
                      value: client?.onboarding?.primaryMotivation
                        ? t(MOTIVATION_KEYS[client.onboarding.primaryMotivation] ?? client.onboarding.primaryMotivation)
                        : t('nutritionGoals.noData'),
                    },
                  ]}
                />
              </div>
            </div>
          )}

          {/* Macros column — visible to nutritionists */}
          {isNutritionist && (
            <GoalsMacroPanel
              kcal={kcal}
              proteinGrams={pGrams}
              carbsGrams={cGrams}
              fatGrams={fGrams}
              proteinPercent={pPct}
              carbsPercent={cPct}
              fatPercent={fPct}
              proteinDistributionPercent={proteinPercent}
              carbsDistributionPercent={carbsPercent}
              fatDistributionPercent={fatPercent}
              result={result}
              onProteinGramsChange={(n) => {
                const [newCarbs, newFat] = redistributeRemainder(n, carbsPercent, fatPercent);
                setProteinPercent(n);
                setCarbsPercent(newCarbs);
                setFatPercent(newFat);
                recalculate({ pp: n, cp: newCarbs, fp: newFat });
              }}
              onCarbsGramsChange={(n) => {
                const [newProtein, newFat] = redistributeRemainder(n, proteinPercent, fatPercent);
                setCarbsPercent(n);
                setProteinPercent(newProtein);
                setFatPercent(newFat);
                recalculate({ pp: newProtein, cp: n, fp: newFat });
              }}
              onFatGramsChange={(n) => {
                const [newProtein, newCarbs] = redistributeRemainder(n, proteinPercent, carbsPercent);
                setFatPercent(n);
                setProteinPercent(newProtein);
                setCarbsPercent(newCarbs);
                recalculate({ pp: newProtein, cp: newCarbs, fp: n });
              }}
              onProteinDistributionChange={(v) => {
                const [nc, nf] = redistributeRemainder(v, carbsPercent, fatPercent);
                setProteinPercent(v);
                setCarbsPercent(nc);
                setFatPercent(nf);
                recalculate({ pp: v, cp: nc, fp: nf });
              }}
              onCarbsDistributionChange={(v) => {
                const [np, nf] = redistributeRemainder(v, proteinPercent, fatPercent);
                setCarbsPercent(v);
                setProteinPercent(np);
                setFatPercent(nf);
                recalculate({ pp: np, cp: v, fp: nf });
              }}
              onFatDistributionChange={(v) => {
                const [np, nc] = redistributeRemainder(v, proteinPercent, carbsPercent);
                setFatPercent(v);
                setProteinPercent(np);
                setCarbsPercent(nc);
                recalculate({ pp: np, cp: nc, fp: v });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

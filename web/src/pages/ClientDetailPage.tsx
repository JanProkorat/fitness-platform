import { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getClientDashboard } from '@/api/nutrition-goals';
import { createPlan, getPlans } from '@/api/plans';
import AnamnesisForm from '@/components/nutrition/AnamnesisForm';
import GoalCalculation from '@/components/nutrition/GoalCalculation';
import MacroSliders from '@/components/nutrition/MacroSliders';
import MealDistribution from '@/components/nutrition/MealDistribution';
import {
  calculateGoals,
  updateClientData,
  type CalculateGoalsResponse,
  type CalculateGoalsRequest,
} from '@/api/nutrition-goals';
import type { AnamnesisData } from '@/components/nutrition/AnamnesisForm';

function Tags({ value, t }: { value: string | undefined | null; t: (key: string) => string }) {
  if (!value) return <span className="text-xs text-muted">&mdash;</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {value.split(',').filter(Boolean).map((tag) => {
        const trimmed = tag.trim();
        const translated = t(`clients.values.${trimmed}`);
        return (
          <span key={trimmed} className="rounded bg-gold/10 px-2 py-0.5 text-xs text-gold">
            {translated !== `clients.values.${trimmed}` ? translated : trimmed}
          </span>
        );
      })}
    </div>
  );
}

function Field({ label, value, changed }: { label: string; value: React.ReactNode; changed?: boolean }) {
  return (
    <div>
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        {changed && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
        <p className={`text-sm font-semibold ${changed ? 'text-amber-400' : ''}`}>{value ?? <span className="text-muted">&mdash;</span>}</p>
      </div>
    </div>
  );
}

const TABS = ['overview', 'lifestyle', 'nutrition', 'motivation'] as const;
type Tab = (typeof TABS)[number];

export default function ClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const openDrawer = useCallback(() => {
    setDrawerMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerVisible(true)));
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false);
    setTimeout(() => setDrawerMounted(false), 300);
  }, []);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Create plan drawer state
  const [planDrawerMounted, setPlanDrawerMounted] = useState(false);
  const [planDrawerVisible, setPlanDrawerVisible] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planWeeks, setPlanWeeks] = useState(1);
  const [creatingPlan, setCreatingPlan] = useState(false);

  const openPlanDrawer = useCallback(() => {
    setPlanName('');
    setPlanWeeks(1);
    setPlanDrawerMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setPlanDrawerVisible(true)));
  }, []);

  const closePlanDrawer = useCallback(() => {
    setPlanDrawerVisible(false);
    setTimeout(() => setPlanDrawerMounted(false), 300);
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim() || !id) return;
    setCreatingPlan(true);
    try {
      const plan = await createPlan({
        clientId: id,
        name: planName,
        weekCount: planWeeks,
        globalSettings: ob?.adjustedKcal ? {
          dailyKcal: result?.adjustedKcal ?? ob.adjustedKcal ?? 0,
          proteinGrams: result?.macroTargets.proteinGrams ?? ob.proteinGrams ?? 0,
          carbsGrams: result?.macroTargets.carbsGrams ?? ob.carbsGrams ?? 0,
          fatGrams: result?.macroTargets.fatGrams ?? ob.fatGrams ?? 0,
        } : undefined,
      });
      closePlanDrawer();
      navigate(`/plans/${plan.planId}`);
    } catch {
      // handled by interceptor
    } finally {
      setCreatingPlan(false);
    }
  };

  // Nutrition calculator state
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<CalculateGoalsResponse | null>(null);
  const [lastRequest, setLastRequest] = useState<AnamnesisData | null>(null);
  const [macros, setMacros] = useState({
    protein: 30,
    carbs: 45,
    fat: 25,
  });
  const [mealDist, setMealDist] = useState<Record<string, number> | null>(null);

  const { data: client, isLoading } = useQuery({
    queryKey: ['client-dashboard', id],
    queryFn: () => getClientDashboard(id!),
    enabled: !!id,
  });

  const { data: clientPlans } = useQuery({
    queryKey: ['client-plans', id],
    queryFn: () => getPlans({ clientId: id!, pageSize: 1 }),
    enabled: !!id,
  });

  const existingPlan = clientPlans?.plans?.[0];

  const clientName = client
    ? `${client.firstName} ${client.lastName}`
    : '...';

  const ob = client?.onboarding;

  /** Translate an enum/tag value via clients.values.X, fall back to raw value */
  const v = (val: string | null | undefined) => {
    if (!val) return '\u2014';
    const key = `clients.values.${val}`;
    const translated = t(key);
    return translated !== key ? translated : val;
  };

  // Detect which fields were changed by the recalculation
  const origAge = client?.dateOfBirth ? new Date(client.dateOfBirth).getFullYear() : null;
  const diff = lastRequest ? {
    weight: lastRequest.weightKg !== (client?.weightKg ?? 0),
    height: lastRequest.heightCm !== (client?.heightCm ?? 0),
    age: origAge != null && lastRequest.age !== (new Date().getFullYear() - origAge),
    sex: ob?.sex != null && lastRequest.sex !== ob.sex,
    activityLevel: ob?.derivedActivityLevel != null && lastRequest.activityLevel !== ob.derivedActivityLevel,
    goal: ob?.derivedNutritionGoal != null && lastRequest.goal !== ob.derivedNutritionGoal,
  } : null;

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
      setActiveTab('nutrition');
      closeDrawer();
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

  const [confirmAction, setConfirmAction] = useState<'save' | 'reset' | null>(null);

  const hasChanges = !!result || !!mealDist;

  const handleSave = async () => {
    if (!id || !hasChanges) return;
    setIsSaving(true);
    try {
      const payload: Parameters<typeof updateClientData>[1] = {};
      if (result && lastRequest) {
        payload.weightKg = lastRequest.weightKg;
        payload.heightCm = lastRequest.heightCm;
        payload.age = lastRequest.age;
        payload.sex = lastRequest.sex;
        payload.derivedActivityLevel = lastRequest.activityLevel;
        payload.derivedNutritionGoal = lastRequest.goal;
        payload.bmr = result.bmr;
        payload.tdee = result.tdee;
        payload.adjustedKcal = result.adjustedKcal;
        payload.proteinGrams = result.macroTargets.proteinGrams;
        payload.carbsGrams = result.macroTargets.carbsGrams;
        payload.fatGrams = result.macroTargets.fatGrams;
      }
      if (mealDist) {
        payload.mealDistribution = JSON.stringify(mealDist);
      }
      await updateClientData(id, payload);
      await queryClient.invalidateQueries({ queryKey: ['client-dashboard', id] });
      setResult(null);
      setLastRequest(null);
      setMealDist(null);
    } catch {
      // handled by interceptor
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setLastRequest(null);
    setMealDist(null);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-border bg-[#111111] px-6 py-4">
        <Link
          to="/clients"
          className="font-heading text-xs font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
        >
          &larr; {t('clients.backToClients')}
        </Link>
        <div className="h-4 w-px bg-border" />
        <div>
          <h1 className="text-lg font-bold">
            {isLoading ? t('common.loading') : clientName}
          </h1>
          <p className="text-xs text-muted">
            {client?.email}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-[#111111] px-6">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-gold text-gold'
                  : 'text-muted hover:text-text2'
              }`}
            >
              {t(`clients.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
            </button>
          ))}
        </div>
        {hasChanges && (
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-amber-400">{t('clients.unsavedChanges')}</span>
            </div>
            <button type="button" onClick={() => setConfirmAction('reset')}
              className="rounded-sm border border-border px-3 py-1.5 font-heading text-[11px] font-extrabold uppercase tracking-wide text-muted transition-colors hover:text-text">
              {t('clients.resetTargets')}
            </button>
            <button type="button" onClick={() => setConfirmAction('save')} disabled={isSaving}
              className="rounded-sm bg-green-600 px-3 py-1.5 font-heading text-[11px] font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-green-500 disabled:opacity-50">
              {isSaving ? t('common.saving') : t('clients.saveTargets')}
            </button>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmAction && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setConfirmAction(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="w-full max-w-sm rounded-sm border border-border bg-bg p-6 shadow-2xl">
              <h3 className="mb-2 text-sm font-bold">
                {confirmAction === 'save' ? t('clients.confirmSaveTitle') : t('clients.confirmResetTitle')}
              </h3>
              <p className="mb-5 text-sm text-muted">
                {confirmAction === 'save' ? t('clients.confirmSaveMessage') : t('clients.confirmResetMessage')}
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmAction(null)}
                  className="rounded-sm border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:text-text">
                  {t('common.cancel')}
                </button>
                <button type="button"
                  onClick={() => { setConfirmAction(null); confirmAction === 'save' ? handleSave() : handleReset(); }}
                  className={`rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors ${
                    confirmAction === 'save' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                  }`}>
                  {confirmAction === 'save' ? t('clients.saveTargets') : t('clients.resetTargets')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted">
            {t('common.loading')}
          </div>
        ) : client ? (
          <div className="mx-auto max-w-3xl space-y-6">
            {/* ========== OVERVIEW TAB ========== */}
            {activeTab === 'overview' && (
              <>
                <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-gold">
                  {t('clients.overview')}
                </h2>

                {/* Stats cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCard
                    label={t('clients.compliance')}
                    value={
                      client.compliancePercent != null
                        ? `${client.compliancePercent}%`
                        : t('clients.noData')
                    }
                  />
                  <StatCard
                    label={t('clients.streak')}
                    value={
                      client.currentStreak != null
                        ? `${client.currentStreak}`
                        : '0'
                    }
                  />
                  <StatCard
                    label={t('clients.measurements')}
                    value={`${client.totalMeasurements ?? 0}`}
                  />
                  <StatCard
                    label={t('clients.photos')}
                    value={`${client.totalProgressPhotos ?? 0}`}
                  />
                </div>

                {ob ? (
                  <>
                    {/* Profile */}
                    <SectionHeading>{t('clients.profile')}</SectionHeading>
                    <div className="rounded-sm border border-border bg-surface p-5">
                      <div className="grid grid-cols-2 gap-4">
                        {(client.dateOfBirth || diff?.age) && (
                          <Field
                            label={t('clients.yearOfBirth')}
                            value={diff?.age && lastRequest ? new Date().getFullYear() - lastRequest.age : client.dateOfBirth ? new Date(client.dateOfBirth).getFullYear() : null}
                            changed={diff?.age}
                          />
                        )}
                        {(client.heightCm != null || diff?.height) && (
                          <Field label={t('nutritionGoals.height')} value={`${diff?.height && lastRequest ? lastRequest.heightCm : client.heightCm} cm`} changed={diff?.height} />
                        )}
                        {(client.weightKg != null || diff?.weight) && (
                          <Field label={t('nutritionGoals.weight')} value={`${diff?.weight && lastRequest ? lastRequest.weightKg : client.weightKg} kg`} changed={diff?.weight} />
                        )}
                        {(ob.sex || diff?.sex) && (
                          <Field label={t('clients.sex')} value={v(diff?.sex && lastRequest ? lastRequest.sex : ob.sex)} changed={diff?.sex} />
                        )}
                        {ob.targetWeightKg != null && (
                          <Field label={t('clients.targetWeight')} value={`${ob.targetWeightKg} kg`} />
                        )}
                        {ob.bodyType && (
                          <Field label={t('clients.bodyType')} value={v(ob.bodyType)} />
                        )}
                        <Field
                          label={t('clients.linkedSince')}
                          value={new Date(client.linkedAt).toLocaleDateString()}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* No onboarding data */}
                    <div className="rounded-sm border border-border bg-surface p-5">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {client.heightCm != null && (
                          <Field label={t('nutritionGoals.height')} value={`${client.heightCm} cm`} />
                        )}
                        {client.weightKg != null && (
                          <Field label={t('nutritionGoals.weight')} value={`${client.weightKg} kg`} />
                        )}
                        {client.dateOfBirth && (
                          <Field
                            label={t('clients.yearOfBirth')}
                            value={new Date(client.dateOfBirth).getFullYear()}
                          />
                        )}
                        <Field
                          label={t('clients.linkedSince')}
                          value={new Date(client.linkedAt).toLocaleDateString()}
                        />
                      </div>
                      {client.goals && (
                        <div className="mt-4">
                          <span className="text-xs text-muted">
                            {t('nutritionGoals.goal')}
                          </span>
                          <p className="text-sm">{client.goals}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-center text-sm text-muted">
                      {t('clients.onboardingNotCompleted')}
                    </p>
                  </>
                )}

                {/* Latest measurement */}
                {client.latestMeasurement && (
                  <div className="rounded-sm border border-border bg-surface p-5">
                    <h3 className="mb-3 text-sm font-semibold text-text2">
                      {t('clients.measurements')}
                    </h3>
                    <div className="flex gap-6">
                      {client.latestMeasurement.weightKg != null && (
                        <div>
                          <span className="text-xs text-muted">
                            {t('clients.latestWeight')}
                          </span>
                          <p className="text-lg font-bold">
                            {client.latestMeasurement.weightKg} kg
                          </p>
                        </div>
                      )}
                      {client.latestMeasurement.bodyFatPercentage != null && (
                        <div>
                          <span className="text-xs text-muted">
                            {t('clients.bodyFat')}
                          </span>
                          <p className="text-lg font-bold">
                            {client.latestMeasurement.bodyFatPercentage}%
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-muted">
                      {new Date(
                        client.latestMeasurement.measuredAt,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                )}

              </>
            )}

            {/* ========== LIFESTYLE TAB ========== */}
            {activeTab === 'lifestyle' && ob && (
              <>
                {/* Goals & Lifestyle */}
                <SectionHeading>{t('clients.goalsLifestyle')}</SectionHeading>
                <div className="rounded-sm border border-border bg-surface p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {ob.primaryGoal && (
                      <Field label={t('clients.primaryGoal')} value={v(ob.primaryGoal)} />
                    )}
                    {ob.timeHorizon && (
                      <Field label={t('clients.timeHorizon')} value={v(ob.timeHorizon)} />
                    )}
                    {ob.jobType && (
                      <Field label={t('clients.jobType')} value={v(ob.jobType)} />
                    )}
                    {ob.sleepHours != null && (
                      <Field label={t('clients.sleep')} value={`${ob.sleepHours} ${t('clients.hoursPerNight')}`} />
                    )}
                    {ob.stressLevel != null && (
                      <Field label={t('clients.stressLevel')} value={`${ob.stressLevel}/5`} />
                    )}
                  </div>
                </div>

                {/* Activity */}
                <SectionHeading>{t('clients.activity')}</SectionHeading>
                <div className="rounded-sm border border-border bg-surface p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {ob.currentTrainingFrequency && (
                      <Field label={t('clients.currentTraining')} value={v(ob.currentTrainingFrequency)} />
                    )}
                    {ob.desiredTrainingFrequency && (
                      <Field label={t('clients.desiredTraining')} value={v(ob.desiredTrainingFrequency)} />
                    )}
                    {ob.fitnessRating != null && (
                      <Field label={t('clients.fitnessRating')} value={`${ob.fitnessRating}/10`} />
                    )}
                    <div>
                      <span className="text-xs text-muted">{t('clients.preferredActivities')}</span>
                      <div className="mt-1"><Tags t={t} value={ob.preferredActivities} /></div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">{t('clients.injuries')}</span>
                      <div className="mt-1"><Tags t={t} value={ob.injuries} /></div>
                    </div>
                  </div>
                </div>

                {/* Nutrition (diet info) */}
                <SectionHeading>{t('clients.nutrition')}</SectionHeading>
                <div className="rounded-sm border border-border bg-surface p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {ob.mealsPerDay && (
                      <Field label={t('clients.mealsPerDay')} value={v(ob.mealsPerDay)} />
                    )}
                    {ob.dietaryStyle && (
                      <Field label={t('clients.dietaryStyle')} value={v(ob.dietaryStyle)} />
                    )}
                    <div>
                      <span className="text-xs text-muted">{t('clients.allergies')}</span>
                      <div className="mt-1"><Tags t={t} value={ob.allergies} /></div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'lifestyle' && !ob && (
              <p className="text-center text-sm text-muted">
                {t('clients.onboardingNotCompleted')}
              </p>
            )}

            {/* ========== NUTRITION TAB ========== */}
            {activeTab === 'nutrition' && ob && (
              <>
                {/* Nutrition Targets (shows recalculated values when available, otherwise onboarding) */}
                {ob.bmr != null && (
                  <>
                    <div className="flex items-center justify-between">
                      <SectionHeading>{t('clients.nutritionTargets')}</SectionHeading>
                      <div className="flex gap-2">
                        <button type="button" onClick={openDrawer}
                          className="rounded-sm bg-gold px-3 py-1.5 font-heading text-[11px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright">
                          {t('clients.recalculate')}
                        </button>
                        <button type="button"
                          onClick={() => existingPlan ? navigate(`/plans/${existingPlan.planId}`) : openPlanDrawer()}
                          className="rounded-sm bg-gold px-3 py-1.5 font-heading text-[11px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright">
                          {existingPlan ? t('clients.nutritionPlans') : t('clients.createPlan')}
                        </button>
                      </div>
                    </div>
                    <div className={`rounded-sm border ${result ? 'border-amber-500/50' : 'border-border'} bg-surface p-5 transition-colors`}>
                      {/* BMR -> TDEE -> Adjusted flow -- use result if available, otherwise onboarding */}
                      <div className="mb-4 flex items-center gap-3 text-sm">
                        <div className="rounded bg-gold/10 px-3 py-2 text-center">
                          <span className="text-xs text-muted">BMR</span>
                          <p className="font-bold text-gold">{result?.bmr ?? ob.bmr} kcal</p>
                        </div>
                        <span className="text-muted">&rarr;</span>
                        <div className="rounded bg-gold/10 px-3 py-2 text-center">
                          <span className="text-xs text-muted">TDEE</span>
                          <p className="font-bold text-gold">{result?.tdee ?? ob.tdee} kcal</p>
                        </div>
                        <span className="text-muted">&rarr;</span>
                        <div className="rounded bg-gold/10 px-3 py-2 text-center">
                          <span className="text-xs text-muted">{t('clients.adjustedKcal')}</span>
                          <p className="font-bold text-gold">{result?.adjustedKcal ?? ob.adjustedKcal} kcal</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {(result ? lastRequest?.activityLevel : ob.derivedActivityLevel) && (
                          <Field label={t('clients.derivedActivity')} value={v(result ? lastRequest?.activityLevel : ob.derivedActivityLevel)} changed={!!diff?.activityLevel} />
                        )}
                        {(result ? lastRequest?.goal : ob.derivedNutritionGoal) && (
                          <Field label={t('clients.derivedGoal')} value={v(result ? lastRequest?.goal : ob.derivedNutritionGoal)} changed={!!diff?.goal} />
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                        <div className="rounded bg-blue-500/10 px-3 py-3">
                          <span className="text-xs text-blue-400">{t('clients.protein')}</span>
                          <p className="text-lg font-bold text-blue-400">{result?.macroTargets.proteinGrams ?? ob.proteinGrams}g</p>
                        </div>
                        <div className="rounded bg-amber-500/10 px-3 py-3">
                          <span className="text-xs text-amber-400">{t('clients.carbs')}</span>
                          <p className="text-lg font-bold text-amber-400">{result?.macroTargets.carbsGrams ?? ob.carbsGrams}g</p>
                        </div>
                        <div className="rounded bg-rose-500/10 px-3 py-3">
                          <span className="text-xs text-rose-400">{t('clients.fat')}</span>
                          <p className="text-lg font-bold text-rose-400">{result?.macroTargets.fatGrams ?? ob.fatGrams}g</p>
                        </div>
                      </div>
                      {!result && (
                        <p className="mt-3 text-[11px] text-muted">{t('clients.nutritionTargetsHint')}</p>
                      )}
                    </div>
                  </>
                )}

                {/* Macro Sliders + Meal Distribution (use recalculated if available, else onboarding) */}
                {(() => {
                  const activeKcal = result?.adjustedKcal ?? ob.adjustedKcal;
                  const activeMacros = result
                    ? result.macroTargets
                    : ob.bmr != null
                      ? { dailyKcal: ob.adjustedKcal ?? 0, proteinGrams: ob.proteinGrams ?? 0, carbsGrams: ob.carbsGrams ?? 0, fatGrams: ob.fatGrams ?? 0 }
                      : null;
                  if (!activeKcal || !activeMacros) return null;
                  return (
                    <>
                      <div className="rounded-sm border border-border bg-surface p-5">
                        <MacroSliders
                          proteinPercent={macros.protein}
                          carbsPercent={macros.carbs}
                          fatPercent={macros.fat}
                          totalKcal={activeKcal}
                          onChange={handleMacroChange}
                        />
                      </div>
                      <div className="rounded-sm border border-border bg-surface p-5">
                        <MealDistribution
                          totalKcal={activeKcal}
                          macroTargets={activeMacros}
                          initialDistribution={ob.mealDistribution ? JSON.parse(ob.mealDistribution) : null}
                          onChange={setMealDist}
                        />
                      </div>
                    </>
                  );
                })()}
              </>
            )}

            {activeTab === 'nutrition' && !ob && (
              <p className="text-center text-sm text-muted">
                {t('clients.onboardingNotCompleted')}
              </p>
            )}

            {/* ========== MOTIVATION TAB ========== */}
            {activeTab === 'motivation' && ob && (
              <>
                <SectionHeading>{t('clients.motivation')}</SectionHeading>
                <div className="rounded-sm border border-border bg-surface p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {ob.planExperience && (
                      <Field label={t('clients.planExperience')} value={v(ob.planExperience)} />
                    )}
                    {ob.primaryMotivation && (
                      <Field label={t('clients.primaryMotivation')} value={v(ob.primaryMotivation)} />
                    )}
                    <div>
                      <span className="text-xs text-muted">{t('clients.pastBlockers')}</span>
                      <div className="mt-1"><Tags t={t} value={ob.pastBlockers} /></div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'motivation' && !ob && (
              <p className="text-center text-sm text-muted">
                {t('clients.onboardingNotCompleted')}
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Nutrition Goals Drawer */}
      {drawerMounted && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${drawerVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeDrawer}
          />
          <div
            className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-border bg-bg shadow-2xl transition-transform duration-300 ease-out ${drawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold">{t('nutritionGoals.title')}</div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="text-text3 transition-colors hover:text-text"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            <div className="space-y-6">
              {/* Anamnesis Form */}
              <div className="rounded-sm border border-border bg-surface p-5">
                <AnamnesisForm
                  client={client}
                  onSubmit={handleCalculate}
                  isLoading={isCalculating}
                />
              </div>

            </div>
          </div>
          </div>
        </>
      )}

      {/* Create Plan Drawer */}
      {planDrawerMounted && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${planDrawerVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={closePlanDrawer}
          />
          <div
            className={`fixed top-0 right-0 z-50 flex h-full w-[400px] flex-col border-l border-border bg-bg shadow-2xl transition-transform duration-300 ease-out ${planDrawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold">{t('clients.createPlan')}</div>
                <button
                  type="button"
                  onClick={closePlanDrawer}
                  className="text-text3 transition-colors hover:text-text"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form id="create-plan-form" onSubmit={handleCreatePlan} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block font-heading text-xs text-text3">
                    {t('nutrition.planName')}
                  </label>
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder={t('nutrition.planNamePlaceholder')}
                    required
                    className="w-full rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-gold/40"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-heading text-xs text-text3">
                    {t('nutrition.weekCount')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={planWeeks}
                    onChange={(e) => setPlanWeeks(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-gold/40"
                  />
                </div>
              </form>
            </div>

            <div className="shrink-0 border-t border-border bg-bg px-6 py-4">
              <button
                type="submit"
                form="create-plan-form"
                disabled={creatingPlan || !planName.trim()}
                className="w-full rounded-sm bg-gold px-5 py-3 font-heading text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
              >
                {creatingPlan ? t('nutrition.saving') : t('clients.createPlan')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-gold">
      {children}
    </h2>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-4 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-text">{value}</p>
    </div>
  );
}

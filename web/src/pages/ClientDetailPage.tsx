import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getClientDashboard } from '@/api/nutrition-goals';
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs text-muted">{label}</span>
      <p className="text-sm font-semibold">{value ?? <span className="text-muted">&mdash;</span>}</p>
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

  const { data: client, isLoading } = useQuery({
    queryKey: ['client-dashboard', id],
    queryFn: () => getClientDashboard(id!),
    enabled: !!id,
  });

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

  const handleSave = async () => {
    if (!result || !lastRequest || !id) return;
    setIsSaving(true);
    try {
      await updateClientData(id, {
        weightKg: lastRequest.weightKg,
        heightCm: lastRequest.heightCm,
        age: lastRequest.age,
        sex: lastRequest.sex,
        derivedActivityLevel: lastRequest.activityLevel,
        derivedNutritionGoal: lastRequest.goal,
        bmr: result.bmr,
        tdee: result.tdee,
        adjustedKcal: result.adjustedKcal,
        proteinGrams: result.macroTargets.proteinGrams,
        carbsGrams: result.macroTargets.carbsGrams,
        fatGrams: result.macroTargets.fatGrams,
      });
      await queryClient.invalidateQueries({ queryKey: ['client-dashboard', id] });
      setResult(null);
      setLastRequest(null);
    } catch {
      // handled by interceptor
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setLastRequest(null);
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
      <div className="flex gap-1 border-b border-border bg-[#111111] px-6">
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
                        {client.dateOfBirth && (
                          <Field
                            label={t('clients.yearOfBirth')}
                            value={new Date(client.dateOfBirth).getFullYear()}
                          />
                        )}
                        {client.heightCm != null && (
                          <Field label={t('nutritionGoals.height')} value={`${client.heightCm} cm`} />
                        )}
                        {client.weightKg != null && (
                          <Field label={t('nutritionGoals.weight')} value={`${client.weightKg} kg`} />
                        )}
                        {ob.sex && (
                          <Field label={t('clients.sex')} value={v(ob.sex)} />
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

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled
                    className="rounded-sm bg-gold/30 px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black/40 cursor-not-allowed"
                  >
                    {t('clients.nutritionPlans')} &rarr;
                  </button>
                </div>
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
                        {result && (
                          <>
                            <button type="button" onClick={handleReset}
                              className="rounded-sm border border-border px-3 py-1.5 font-heading text-[11px] font-extrabold uppercase tracking-wide text-muted transition-colors hover:text-text">
                              {t('clients.resetTargets')}
                            </button>
                            <button type="button" onClick={handleSave} disabled={isSaving}
                              className="rounded-sm bg-green-600 px-3 py-1.5 font-heading text-[11px] font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-green-500 disabled:opacity-50">
                              {isSaving ? t('common.saving') : t('clients.saveTargets')}
                            </button>
                          </>
                        )}
                        <button type="button" onClick={openDrawer}
                          className="rounded-sm bg-gold px-3 py-1.5 font-heading text-[11px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright">
                          {t('clients.recalculate')}
                        </button>
                      </div>
                    </div>
                    <div className={`rounded-sm border ${result ? 'border-amber-500/50' : 'border-border'} bg-surface p-5 transition-colors`}>
                      {result && (
                        <div className="mb-3 flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                          <span className="text-xs font-medium text-amber-400">{t('clients.unsavedChanges')}</span>
                        </div>
                      )}
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
                          <Field label={t('clients.derivedActivity')} value={v(result ? lastRequest?.activityLevel : ob.derivedActivityLevel)} />
                        )}
                        {(result ? lastRequest?.goal : ob.derivedNutritionGoal) && (
                          <Field label={t('clients.derivedGoal')} value={v(result ? lastRequest?.goal : ob.derivedNutritionGoal)} />
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

              {/* Calculation Results */}
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

              {/* Macro Sliders */}
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

              {/* Meal Distribution */}
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

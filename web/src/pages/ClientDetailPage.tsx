import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getClientDashboard } from '@/api/nutrition-goals';
import AnamnesisForm from '@/components/nutrition/AnamnesisForm';
import GoalCalculation from '@/components/nutrition/GoalCalculation';
import MacroSliders from '@/components/nutrition/MacroSliders';
import MealDistribution from '@/components/nutrition/MealDistribution';
import {
  calculateGoals,
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Nutrition calculator state
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
                    onClick={() => setDrawerOpen(true)}
                    className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
                  >
                    {t('clients.nutritionGoals')} &rarr;
                  </button>
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
                {/* Nutrition */}
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

                {/* Nutrition Targets (auto-calculated) */}
                {ob.bmr != null && (
                  <>
                    <SectionHeading>{t('clients.nutritionTargets')}</SectionHeading>
                    <div className="rounded-sm border border-border bg-surface p-5">
                      {/* BMR -> TDEE -> Adjusted flow */}
                      <div className="mb-4 flex items-center gap-3 text-sm">
                        <div className="rounded bg-gold/10 px-3 py-2 text-center">
                          <span className="text-xs text-muted">BMR</span>
                          <p className="font-bold text-gold">{ob.bmr} kcal</p>
                        </div>
                        <span className="text-muted">&rarr;</span>
                        <div className="rounded bg-gold/10 px-3 py-2 text-center">
                          <span className="text-xs text-muted">TDEE</span>
                          <p className="font-bold text-gold">{ob.tdee} kcal</p>
                        </div>
                        <span className="text-muted">&rarr;</span>
                        <div className="rounded bg-gold/10 px-3 py-2 text-center">
                          <span className="text-xs text-muted">{t('clients.adjustedKcal')}</span>
                          <p className="font-bold text-gold">{ob.adjustedKcal} kcal</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {ob.derivedActivityLevel && (
                          <Field label={t('clients.derivedActivity')} value={v(ob.derivedActivityLevel)} />
                        )}
                        {ob.derivedNutritionGoal && (
                          <Field label={t('clients.derivedGoal')} value={v(ob.derivedNutritionGoal)} />
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
                      <p className="mt-3 text-[11px] text-muted">{t('clients.nutritionTargetsHint')}</p>
                    </div>
                  </>
                )}

                {/* Recalculate button */}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
                  >
                    {t('clients.recalculate')} &rarr;
                  </button>
                </div>
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
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/50" onClick={() => setDrawerOpen(false)} />
          {/* Panel */}
          <div className="w-full max-w-xl overflow-y-auto border-l border-border bg-bg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t('nutritionGoals.title')}</h2>
              <button onClick={() => setDrawerOpen(false)} className="text-muted hover:text-text">&#10005;</button>
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

import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/components/layout';
import { Button, Select, ProgressBar } from '@/components/ui';
import { PropertyList, Callout } from '@/components/data';
import {
  calculateGoals,
  getClientDashboard,
  updateClientData,
  type CalculateGoalsRequest,
  type CalculateGoalsResponse,
} from '@/api/nutrition-goals';

const ACTIVITY_KEYS: Record<string, string> = {
  Sedentary: 'clients.values.Sedentary',
  LightlyActive: 'clients.values.LightlyActive',
  ModeratelyActive: 'clients.values.ModeratelyActive',
  VeryActive: 'clients.values.VeryActive',
  ExtremelyActive: 'clients.values.ExtremelyActive',
};

const GOAL_KEYS: Record<string, string> = {
  Cut: 'nutritionGoals.cutLabel',
  Maintain: 'nutritionGoals.maintainLabel',
  Bulk: 'nutritionGoals.bulkLabel',
};

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

const SEX_KEYS: Record<string, string> = {
  Male: 'nutritionGoals.sexMale',
  Female: 'nutritionGoals.sexFemale',
};

export default function ClientNutritionGoalsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

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
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text3 mb-2.5">
              {t('nutritionGoals.anamnesis')}
            </div>
            <div className="bg-bg2 border border-border rounded-md p-2 mb-4">
              <PropertyList
                className="mb-0"
                items={[
                  {
                    label: t('nutritionGoals.age'),
                    icon: '📅',
                    value: `${age}`,
                    editable: true,
                    onEdit: (v) => {
                      const n = parseInt(v);
                      if (!isNaN(n)) { setAge(n); recalculate({ age: n }); }
                    },
                  },
                  {
                    label: t('nutritionGoals.sex'),
                    icon: '👤',
                    value: t(SEX_KEYS[sex] || sex),
                    editable: true,
                    onEdit: (v) => {
                      const s = v.toLowerCase().startsWith('m') ? 'Male' as const : 'Female' as const;
                      setSex(s);
                      recalculate({ sex: s });
                    },
                  },
                  {
                    label: t('nutritionGoals.height'),
                    icon: '📏',
                    value: `${heightCm} cm`,
                    editable: true,
                    onEdit: (v) => {
                      const n = parseFloat(v);
                      if (!isNaN(n)) { setHeightCm(n); recalculate({ heightCm: n }); }
                    },
                  },
                  {
                    label: t('nutritionGoals.weight'),
                    icon: '⚖',
                    value: `${weightKg} kg`,
                    editable: true,
                    onEdit: (v) => {
                      const n = parseFloat(v);
                      if (!isNaN(n)) { setWeightKg(n); recalculate({ weightKg: n }); }
                    },
                  },
                  {
                    label: t('nutritionGoals.targetWeight'),
                    icon: '🎯',
                    value: `${targetWeight} kg`,
                    editable: true,
                    onEdit: (v) => {
                      const n = parseFloat(v);
                      if (!isNaN(n)) setTargetWeight(n);
                    },
                  },
                  {
                    label: t('nutritionGoals.activityLevel'),
                    icon: '⚡',
                    value: t(ACTIVITY_KEYS[activityLevel] || activityLevel),
                    editable: true,
                    onEdit: (v) => {
                      const match = Object.entries(ACTIVITY_LABELS).find(([, label]) =>
                        label.toLowerCase().startsWith(v.toLowerCase()),
                      );
                      if (match) {
                        const al = match[0] as CalculateGoalsRequest['activityLevel'];
                        setActivityLevel(al);
                        recalculate({ activityLevel: al });
                      }
                    },
                  },
                ]}
              />
            </div>

            <div className="text-[13px] font-semibold mb-2">{t('nutritionGoals.goal')}</div>
            <div className="mb-4">
              <Select
                value={goal}
                onChange={(e) => {
                  const g = e.target.value as CalculateGoalsRequest['goal'];
                  setGoal(g);
                  recalculate({ goal: g });
                }}
              >
                <option value="Cut">{t('nutritionGoals.cutLabel')}</option>
                <option value="Maintain">{t('nutritionGoals.maintainLabel')}</option>
                <option value="Bulk">{t('nutritionGoals.bulkLabel')}</option>
              </Select>
            </div>

            {!result && isNutritionist && (
              <Button
                variant="primary"
                onClick={() => recalculate()}
                disabled={isCalculating}
                className="w-full justify-center"
              >
                {isCalculating ? t('nutritionGoals.calculating') : t('nutritionGoals.calculate')}
              </Button>
            )}

            {result && isNutritionist && (
              <>
                <div className="text-[13px] font-semibold mb-2">{t('nutritionGoals.calculation')}</div>
                <Callout icon="🧮" title="Mifflin-St Jeor" variant="info" className="bg-bg2 border border-border">
                  <div className="text-[13px] text-text2">
                    {t('nutritionGoals.bmr')} = {Math.round(result.bmr).toLocaleString('cs')} kcal
                    {' · '}
                    {t('nutritionGoals.tdee')} = {Math.round(result.tdee).toLocaleString('cs')} kcal
                    {' · '}
                    {t(GOAL_KEYS[goal])}
                    {' → '}
                    <strong>{t('nutritionGoals.goalTarget')} {Math.round(result.adjustedKcal).toLocaleString('cs')} kcal</strong>
                  </div>
                </Callout>
                <div className="text-[11px] text-text3 mt-2 leading-relaxed">
                  {t('nutritionGoals.mifflinFormula')} {sex === 'Female' ? t('nutritionGoals.mifflinFemaleOffset') : t('nutritionGoals.mifflinMaleOffset')}.
                  {' '}{t('nutritionGoals.tdeeFormula')}
                </div>
              </>
            )}
          </div>

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
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text3 mb-2.5">
              {t('nutritionGoals.targetMacros')}
            </div>

            {result ? (
              <>
                <div className="bg-bg2 border border-border rounded-md p-2 mb-3.5">
                  <PropertyList
                    className="mb-0"
                    items={[
                      {
                        label: t('nutritionGoals.caloriesPerDay'),
                        value: (
                          <span className="font-semibold">
                            {Math.round(kcal).toLocaleString('cs')} kcal
                          </span>
                        ),
                      },
                      {
                        label: t('nutritionGoals.protein'),
                        icon: '',
                        value: (
                          <span className="flex items-center gap-2">
                            <span className="w-[7px] h-[7px] rounded-sm bg-blue shrink-0" />
                            <span className="font-semibold text-blue">{pGrams} g</span>
                            <span className="text-xs text-text3">{pPct} %</span>
                          </span>
                        ),
                        editable: true,
                        onEdit: (v) => {
                          const n = parseInt(v);
                          if (!isNaN(n) && n >= 5 && n <= 60) {
                            const remainder = 100 - n;
                            const newCarbs = Math.round(remainder * carbsPercent / (carbsPercent + fatPercent));
                            const newFat = remainder - newCarbs;
                            setProteinPercent(n);
                            setCarbsPercent(newCarbs);
                            setFatPercent(newFat);
                            recalculate({ pp: n, cp: newCarbs, fp: newFat });
                          }
                        },
                      },
                      {
                        label: t('nutritionGoals.carbs'),
                        icon: '',
                        value: (
                          <span className="flex items-center gap-2">
                            <span className="w-[7px] h-[7px] rounded-sm bg-orange shrink-0" />
                            <span className="font-semibold text-orange">{cGrams} g</span>
                            <span className="text-xs text-text3">{cPct} %</span>
                          </span>
                        ),
                        editable: true,
                        onEdit: (v) => {
                          const n = parseInt(v);
                          if (!isNaN(n) && n >= 5 && n <= 70) {
                            const remainder = 100 - n;
                            const newProtein = Math.round(remainder * proteinPercent / (proteinPercent + fatPercent));
                            const newFat = remainder - newProtein;
                            setCarbsPercent(n);
                            setProteinPercent(newProtein);
                            setFatPercent(newFat);
                            recalculate({ pp: newProtein, cp: n, fp: newFat });
                          }
                        },
                      },
                      {
                        label: t('nutritionGoals.fat'),
                        icon: '',
                        value: (
                          <span className="flex items-center gap-2">
                            <span className="w-[7px] h-[7px] rounded-sm bg-purple shrink-0" />
                            <span className="font-semibold text-purple">{fGrams} g</span>
                            <span className="text-xs text-text3">{fPct} %</span>
                          </span>
                        ),
                        editable: true,
                        onEdit: (v) => {
                          const n = parseInt(v);
                          if (!isNaN(n) && n >= 5 && n <= 50) {
                            const remainder = 100 - n;
                            const newProtein = Math.round(remainder * proteinPercent / (proteinPercent + carbsPercent));
                            const newCarbs = remainder - newProtein;
                            setFatPercent(n);
                            setProteinPercent(newProtein);
                            setCarbsPercent(newCarbs);
                            recalculate({ pp: newProtein, cp: newCarbs, fp: n });
                          }
                        },
                      },
                    ]}
                  />
                </div>

                {/* Stacked macro bar */}
                <div className="h-[10px] rounded-full overflow-hidden flex mb-1.5">
                  <div style={{ width: `${pPct}%` }} className="bg-blue" />
                  <div style={{ width: `${cPct}%` }} className="bg-orange" />
                  <div style={{ width: `${fPct}%` }} className="bg-purple" />
                </div>
                <div className="flex gap-3 flex-wrap text-[11px] text-text3 mb-6">
                  <span className="flex items-center gap-1.5">
                    <span className="w-[7px] h-[7px] rounded-sm bg-blue inline-block" />
                    {t('nutritionGoals.protein')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-[7px] h-[7px] rounded-sm bg-orange inline-block" />
                    {t('nutritionGoals.carbs')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-[7px] h-[7px] rounded-sm bg-purple inline-block" />
                    {t('nutritionGoals.fat')}
                  </span>
                </div>

                {/* Detailed macro progress bars */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-text2 flex items-center gap-1.5">
                        <span className="w-[7px] h-[7px] rounded-sm bg-blue" />
                        {t('nutritionGoals.protein')}
                      </span>
                      <span className="text-xs tabular-nums">
                        <span className="font-semibold text-text">{pGrams}g</span>
                        <span className="text-text3"> / {pGrams}g</span>
                      </span>
                    </div>
                    <ProgressBar value={100} color="var(--blue)" height={4} />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-text2 flex items-center gap-1.5">
                        <span className="w-[7px] h-[7px] rounded-sm bg-orange" />
                        {t('nutritionGoals.carbs')}
                      </span>
                      <span className="text-xs tabular-nums">
                        <span className="font-semibold text-text">{cGrams}g</span>
                        <span className="text-text3"> / {cGrams}g</span>
                      </span>
                    </div>
                    <ProgressBar value={100} color="var(--orange)" height={4} />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-text2 flex items-center gap-1.5">
                        <span className="w-[7px] h-[7px] rounded-sm bg-purple" />
                        {t('nutritionGoals.fat')}
                      </span>
                      <span className="text-xs tabular-nums">
                        <span className="font-semibold text-text">{fGrams}g</span>
                        <span className="text-text3"> / {fGrams}g</span>
                      </span>
                    </div>
                    <ProgressBar value={100} color="var(--purple)" height={4} />
                  </div>
                </div>

                {/* Macro sliders */}
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('nutritionGoals.macroDistribution')}
                  </div>
                  {([
                    { label: t('nutritionGoals.protein'), value: proteinPercent, set: (v: number) => {
                      const r = 100 - v; const nc = Math.round(r * carbsPercent / (carbsPercent + fatPercent)); const nf = r - nc;
                      setProteinPercent(v); setCarbsPercent(nc); setFatPercent(nf); recalculate({ pp: v, cp: nc, fp: nf });
                    }, color: 'var(--blue)', max: 60 },
                    { label: t('nutritionGoals.carbs'), value: carbsPercent, set: (v: number) => {
                      const r = 100 - v; const np = Math.round(r * proteinPercent / (proteinPercent + fatPercent)); const nf = r - np;
                      setCarbsPercent(v); setProteinPercent(np); setFatPercent(nf); recalculate({ pp: np, cp: v, fp: nf });
                    }, color: 'var(--orange)', max: 70 },
                    { label: t('nutritionGoals.fat'), value: fatPercent, set: (v: number) => {
                      const r = 100 - v; const np = Math.round(r * proteinPercent / (proteinPercent + carbsPercent)); const nc = r - np;
                      setFatPercent(v); setProteinPercent(np); setCarbsPercent(nc); recalculate({ pp: np, cp: nc, fp: v });
                    }, color: 'var(--purple)', max: 50 },
                  ] as const).map((s) => (
                    <div key={s.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{s.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.value} %</span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={s.max}
                        value={s.value}
                        onChange={(e) => s.set(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: s.color, cursor: 'pointer' }}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-[13px] text-text3 py-8 text-center">
                {t('nutritionGoals.notCalculated')}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

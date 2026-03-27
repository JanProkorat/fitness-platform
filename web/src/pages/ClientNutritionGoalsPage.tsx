import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Breadcrumb, PageHeader, Toolbar } from '@/components/layout';
import { Button, Select, ProgressBar } from '@/components/ui';
import { PropertyList, Callout } from '@/components/data';
import {
  calculateGoals,
  getClientDashboard,
  updateClientData,
  type CalculateGoalsRequest,
  type CalculateGoalsResponse,
} from '@/api/nutrition-goals';

const ACTIVITY_LABELS: Record<string, string> = {
  Sedentary: 'Sedavý',
  LightlyActive: 'Mírná',
  ModeratelyActive: 'Střední',
  VeryActive: 'Vysoká',
  ExtremelyActive: 'Extrémní',
};

const GOAL_LABELS: Record<string, string> = {
  Cut: 'Hubnutí (−20 %)',
  Maintain: 'Udržení',
  Bulk: 'Nabírání (+15 %)',
};

const SEX_LABELS: Record<string, string> = {
  Male: 'Muž',
  Female: 'Žena',
};

export default function ClientNutritionGoalsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

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
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Klienti', href: '/clients' },
          { label: clientName, href: `/clients/${id}` },
          { label: 'Cile & Makra' },
        ]}
      />
      <PageHeader
        icon="🎯"
        title="Cile a makra"
        subtitle={`${clientName} · Vypocet kalorickeho cile`}
        actions={
          <div className="flex gap-1.5">
            <Button onClick={() => window.history.back()}>
              &larr; Zpet
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!result || saving}
            >
              {saving ? 'Ukladam...' : 'Ulozit zmeny'}
            </Button>
          </div>
        }
      />
      <Toolbar />

      <div className="px-20 py-3">
        <div className="grid grid-cols-[1fr_1fr] gap-8">
          {/* Left column - Anamneza */}
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text3 mb-2.5">
              Anamneza
            </div>
            <div className="bg-bg2 border border-border rounded-md p-2 mb-4">
              <PropertyList
                className="mb-0"
                items={[
                  {
                    label: 'Vek',
                    icon: '📅',
                    value: `${age} let`,
                    editable: true,
                    onEdit: (v) => {
                      const n = parseInt(v);
                      if (!isNaN(n)) { setAge(n); recalculate({ age: n }); }
                    },
                  },
                  {
                    label: 'Pohlavi',
                    icon: '👤',
                    value: SEX_LABELS[sex] || sex,
                    editable: true,
                    onEdit: (v) => {
                      const s = v.toLowerCase().startsWith('m') ? 'Male' as const : 'Female' as const;
                      setSex(s);
                      recalculate({ sex: s });
                    },
                  },
                  {
                    label: 'Vyska',
                    icon: '📏',
                    value: `${heightCm} cm`,
                    editable: true,
                    onEdit: (v) => {
                      const n = parseFloat(v);
                      if (!isNaN(n)) { setHeightCm(n); recalculate({ heightCm: n }); }
                    },
                  },
                  {
                    label: 'Vaha',
                    icon: '⚖',
                    value: `${weightKg} kg`,
                    editable: true,
                    onEdit: (v) => {
                      const n = parseFloat(v);
                      if (!isNaN(n)) { setWeightKg(n); recalculate({ weightKg: n }); }
                    },
                  },
                  {
                    label: 'Cilova vaha',
                    icon: '🎯',
                    value: `${targetWeight} kg`,
                    editable: true,
                    onEdit: (v) => {
                      const n = parseFloat(v);
                      if (!isNaN(n)) setTargetWeight(n);
                    },
                  },
                  {
                    label: 'Aktivita',
                    icon: '⚡',
                    value: ACTIVITY_LABELS[activityLevel] || activityLevel,
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

            <div className="text-[13px] font-semibold mb-2">Cil</div>
            <div className="mb-4">
              <Select
                value={goal}
                onChange={(e) => {
                  const g = e.target.value as CalculateGoalsRequest['goal'];
                  setGoal(g);
                  recalculate({ goal: g });
                }}
              >
                <option value="Cut">Hubnuti (deficit −20 %)</option>
                <option value="Maintain">Udrzeni</option>
                <option value="Bulk">Nabirani (+15 %)</option>
              </Select>
            </div>

            {!result && (
              <Button
                variant="primary"
                onClick={() => recalculate()}
                disabled={isCalculating}
                className="w-full justify-center"
              >
                {isCalculating ? 'Pocitam...' : 'Vypocitat'}
              </Button>
            )}

            {result && (
              <>
                <div className="text-[13px] font-semibold mb-2">Vypocet</div>
                <Callout icon="🧮" title="Mifflin-St Jeor" variant="info" className="bg-bg2 border border-border">
                  <div className="text-[13px] text-text2">
                    BMR = {Math.round(result.bmr).toLocaleString('cs')} kcal
                    {' · '}
                    TDEE = {Math.round(result.tdee).toLocaleString('cs')} kcal
                    {' · '}
                    {GOAL_LABELS[goal]}
                    {' → '}
                    <strong>cil {Math.round(result.adjustedKcal).toLocaleString('cs')} kcal</strong>
                  </div>
                </Callout>
                <div className="text-[11px] text-text3 mt-2 leading-relaxed">
                  Mifflin-St Jeor: BMR = 10 × vaha + 6,25 × vyska − 5 × vek {sex === 'Female' ? '− 161' : '+ 5'}.
                  TDEE = BMR × faktor aktivity.
                </div>
              </>
            )}
          </div>

          {/* Right column - Makra */}
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text3 mb-2.5">
              Cilove makra
            </div>

            {result ? (
              <>
                <div className="bg-bg2 border border-border rounded-md p-2 mb-3.5">
                  <PropertyList
                    className="mb-0"
                    items={[
                      {
                        label: 'Kalorie / den',
                        value: (
                          <span className="font-semibold">
                            {Math.round(kcal).toLocaleString('cs')} kcal
                          </span>
                        ),
                      },
                      {
                        label: 'Bilkoviny',
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
                        label: 'Sacharidy',
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
                        label: 'Tuky',
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
                    Bilkoviny
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-[7px] h-[7px] rounded-sm bg-orange inline-block" />
                    Sacharidy
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-[7px] h-[7px] rounded-sm bg-purple inline-block" />
                    Tuky
                  </span>
                </div>

                {/* Detailed macro progress bars */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-text2 flex items-center gap-1.5">
                        <span className="w-[7px] h-[7px] rounded-sm bg-blue" />
                        Bilkoviny
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
                        Sacharidy
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
                        Tuky
                      </span>
                      <span className="text-xs tabular-nums">
                        <span className="font-semibold text-text">{fGrams}g</span>
                        <span className="text-text3"> / {fGrams}g</span>
                      </span>
                    </div>
                    <ProgressBar value={100} color="var(--purple)" height={4} />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-[13px] text-text3 py-8 text-center">
                Nejprve vyplnte anamnezi a spustte vypocet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

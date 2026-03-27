import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

import { Breadcrumb, PageHeader } from '@/components/layout';
import { Button, Tag, Dialog, Input, Select } from '@/components/ui';
import { PropertyList, StatsGrid, Mention } from '@/components/data';
import { ActivityTimeline } from '@/components/domain';

export default function ClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Nutrition Goals drawer state (reuse Dialog)
  const [goalsDialogOpen, setGoalsDialogOpen] = useState(false);

  // Create plan dialog state
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planWeeks, setPlanWeeks] = useState(1);
  const [creatingPlan, setCreatingPlan] = useState(false);

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

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<'save' | 'reset' | null>(null);

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
    if (!val) return '—';
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

  const hasChanges = !!result || !!mealDist;

  // Compliance color helper
  const complianceColor = useMemo(() => {
    const cp = client?.compliancePercent;
    if (cp == null) return 'text-text3';
    if (cp >= 80) return 'text-green';
    if (cp >= 60) return 'text-orange';
    return 'text-red';
  }, [client?.compliancePercent]);

  const complianceVariant = useMemo((): 'green' | 'orange' | 'red' | 'gray' => {
    const cp = client?.compliancePercent;
    if (cp == null) return 'gray';
    if (cp >= 80) return 'green';
    if (cp >= 60) return 'orange';
    return 'red';
  }, [client?.compliancePercent]);

  // Weight progress
  const weightProgress = useMemo(() => {
    if (!client?.weightKg || !client?.latestMeasurement?.weightKg) return null;
    const diff = client.latestMeasurement.weightKg - client.weightKg;
    return Math.round(diff * 10) / 10;
  }, [client]);

  // Goal tag variant
  const goalTagVariant = useMemo((): 'blue' | 'green' | 'orange' | 'purple' => {
    const goal = ob?.derivedNutritionGoal || ob?.primaryGoal;
    if (!goal) return 'blue';
    const lower = goal.toLowerCase();
    if (lower.includes('cut') || lower.includes('hubn')) return 'blue';
    if (lower.includes('bulk') || lower.includes('nabr')) return 'purple';
    return 'green';
  }, [ob]);

  // Handlers
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
      setGoalsDialogOpen(false);
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
      setPlanDialogOpen(false);
      navigate(`/plans/${plan.planId}`);
    } catch {
      // handled by interceptor
    } finally {
      setCreatingPlan(false);
    }
  };

  // Calculate age from dateOfBirth
  const clientAge = useMemo(() => {
    if (!client?.dateOfBirth) return null;
    const birth = new Date(client.dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }, [client?.dateOfBirth]);

  // Build property list items
  const propertyItems = useMemo(() => {
    if (!client) return [];
    const items: Array<{
      label: string;
      icon?: string;
      value: React.ReactNode;
      editable?: boolean;
      onEdit?: (value: string) => void;
    }> = [];

    // Vek
    if (clientAge != null) {
      items.push({
        label: 'Věk',
        icon: '📅',
        value: `${clientAge} let`,
        editable: false,
      });
    }

    // Vyska / vaha
    const height = client.heightCm;
    const weight = client.latestMeasurement?.weightKg ?? client.weightKg;
    if (height != null || weight != null) {
      const weightDiff = weightProgress;
      items.push({
        label: 'Výška / váha',
        icon: '📏',
        value: (
          <span>
            {height != null ? `${height} cm` : ''}
            {height != null && weight != null ? ' · ' : ''}
            {weight != null ? `${weight} kg` : ''}
            {weightDiff != null && weightDiff !== 0 && (
              <span className={`ml-1.5 text-xs ${weightDiff < 0 ? 'text-green' : 'text-orange'}`}>
                {weightDiff < 0 ? '↓' : '↑'} {Math.abs(weightDiff)} kg
              </span>
            )}
          </span>
        ),
      });
    }

    // Cilova vaha
    if (ob?.targetWeightKg != null) {
      items.push({
        label: 'Cílová váha',
        icon: '🎯',
        value: `${ob.targetWeightKg} kg`,
        editable: true,
      });
    }

    // Email
    if (client.email) {
      items.push({
        label: 'Email',
        icon: '✉',
        value: <span className="text-blue">{client.email}</span>,
      });
    }

    // Aktivni plany
    items.push({
      label: 'Aktivní plány',
      icon: '📋',
      value: (
        <span className="flex flex-wrap items-center gap-1.5">
          {existingPlan ? (
            <Mention onClick={() => navigate(`/plans/${existingPlan.planId}`)}>
              🥗 {existingPlan.name}
            </Mention>
          ) : (
            <span className="text-text3">{t('clients.noPlans') !== 'clients.noPlans' ? t('clients.noPlans') : 'Žádné plány'}</span>
          )}
        </span>
      ),
    });

    // Alergie
    if (ob?.allergies) {
      items.push({
        label: 'Alergie',
        icon: '⚠',
        value: ob.allergies,
        editable: true,
      });
    }

    return items;
  }, [client, clientAge, weightProgress, ob, existingPlan, navigate, t]);

  // Build stats
  const statsItems = useMemo(() => {
    if (!client) return [];
    return [
      {
        label: 'Compliance',
        value: client.compliancePercent != null ? `${client.compliancePercent} %` : '—',
        valueColor: complianceColor,
      },
      {
        label: 'Streak',
        value: client.currentStreak > 0 ? `${client.currentStreak} dní` : '0',
      },
      {
        label: 'Pokrok váhy',
        value: weightProgress != null && weightProgress !== 0
          ? `${weightProgress > 0 ? '+' : ''}${weightProgress} kg`
          : '—',
        valueColor: weightProgress != null && weightProgress < 0 ? 'text-green' : weightProgress != null && weightProgress > 0 ? 'text-orange' : undefined,
      },
    ];
  }, [client, complianceColor, weightProgress]);

  // Build weight progress chart data (simple bars)
  const weightChartData = useMemo(() => {
    // We only have current weight and latest measurement; generate a simple set of placeholder bars
    if (!client?.weightKg) return null;
    const baseWeight = client.weightKg;
    const latestWeight = client.latestMeasurement?.weightKg ?? baseWeight;
    const targetWeight = ob?.targetWeightKg ?? latestWeight;
    // Generate 5 points for visualization
    const maxVal = Math.max(baseWeight, latestWeight, targetWeight) + 2;
    const minVal = Math.min(baseWeight, latestWeight, targetWeight) - 2;
    const range = maxVal - minVal || 1;

    return {
      bars: [
        { label: 'Start', value: baseWeight, pct: ((baseWeight - minVal) / range) * 100 },
        { label: 'Aktuální', value: latestWeight, pct: ((latestWeight - minVal) / range) * 100 },
        { label: 'Cíl', value: targetWeight, pct: ((targetWeight - minVal) / range) * 100 },
      ],
    };
  }, [client, ob]);

  // Build activity timeline items
  const activityItems = useMemo(() => {
    // Generate some items from available data
    const items: Array<{ id: string; date: string; title: string; description?: string; icon?: string }> = [];

    if (client?.latestMeasurement) {
      items.push({
        id: 'measurement',
        date: new Date(client.latestMeasurement.measuredAt).toLocaleDateString('cs-CZ'),
        title: 'Tělesné míry zadány',
        icon: '📏',
        description: client.latestMeasurement.weightKg != null
          ? `Váha: ${client.latestMeasurement.weightKg} kg`
          : undefined,
      });
    }

    if (client?.linkedAt) {
      items.push({
        id: 'linked',
        date: new Date(client.linkedAt).toLocaleDateString('cs-CZ'),
        title: 'Klient propojen',
        icon: '🔗',
      });
    }

    return items;
  }, [client]);

  // Subtitle for PageHeader
  const subtitleNode = useMemo(() => {
    if (!client) return undefined;
    const goal = ob?.primaryGoal || ob?.derivedNutritionGoal || client.goals;
    return (
      <div className="flex items-center gap-2 mt-1.5">
        {goal && <Tag variant={goalTagVariant}>{v(goal)}</Tag>}
        {client.currentStreak > 0 && (
          <Tag variant="green">{'🔥'} {client.currentStreak} dní streak</Tag>
        )}
        {client.compliancePercent != null && (
          <Tag variant={complianceVariant}>{client.compliancePercent} % compliance</Tag>
        )}
      </div>
    );
  }, [client, ob, goalTagVariant, complianceVariant]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-text3">
        {t('common.loading')}
      </div>
    );
  }

  if (!client) return null;

  // Client has not registered yet — show pending invite state
  const isPending = !client.onboarding && !client.heightCm && !client.weightKg && !client.dateOfBirth;

  if (isPending) {
    return (
      <div className="flex h-full flex-col">
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: clientName },
          ]}
        />
        <PageHeader icon="👤" title={clientName} />
        <div style={{ padding: '40px 80px', maxWidth: 600 }}>
          <div style={{
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent-br)',
            borderRadius: 'var(--radius-md)',
            padding: '24px 28px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>✉️</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Pozvánka odeslána</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{client.email}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              Klient zatím nemá vytvořený účet. Na jeho email byla odeslána pozvánka
              s odkazem pro registraci. Po registraci si klient vyplní své údaje
              (váha, výška, cíle, alergie) a jeho profil se zde automaticky doplní.
            </div>
          </div>

          <div style={{
            marginTop: 20,
            padding: '16px 20px',
            background: 'var(--bg2)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--text3)',
          }}>
            <div style={{ fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>Co se stane po registraci klienta?</div>
            <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Klient vyplní svou anamnézu a osobní údaje</li>
              <li>Budete moci nastavit jeho výživové cíle a makra</li>
              <li>Můžete mu vytvořit jídelníček a tréninkový plán</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: clientName },
        ]}
      />

      {/* Page Header */}
      <PageHeader
        icon="👤"
        title={clientName}
        subtitle={undefined}
        actions={
          <div className="flex items-center gap-1.5">
            {hasChanges && (
              <>
                <span className="inline-flex items-center gap-1.5 mr-2 text-xs text-orange">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange" />
                  {t('clients.unsavedChanges') !== 'clients.unsavedChanges' ? t('clients.unsavedChanges') : 'Neuložené změny'}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction('reset')}>
                  {t('clients.resetTargets') !== 'clients.resetTargets' ? t('clients.resetTargets') : 'Resetovat'}
                </Button>
                <Button variant="primary" size="sm" onClick={() => setConfirmAction('save')} disabled={isSaving}>
                  {isSaving
                    ? (t('common.saving') !== 'common.saving' ? t('common.saving') : 'Ukládání...')
                    : (t('clients.saveTargets') !== 'clients.saveTargets' ? t('clients.saveTargets') : 'Uložit')
                  }
                </Button>
              </>
            )}
            <Button onClick={() => setEditDialogOpen(true)}>
              ✏ Upravit profil
            </Button>
            <Button variant="primary" onClick={() => navigate('/messages')}>
              ✉ Napsat zprávu
            </Button>
          </div>
        }
      />

      {/* Subtitle tags below header */}
      <div className="px-20 pb-2">
        {subtitleNode}
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-20 py-3 max-w-[1200px]">
          {/* Property List */}
          <PropertyList items={propertyItems} />

          {/* Divider */}
          <div className="h-px bg-border my-3.5" />

          {/* Stats Grid */}
          <StatsGrid stats={statsItems} columns={3} />

          {/* Weight Progress Chart */}
          {weightChartData && (
            <div className="mb-4">
              <div className="text-[11px] text-text3 font-medium uppercase tracking-[0.04em] mb-2">
                Váhový progres
              </div>
              <div className="flex items-end gap-3 h-[80px]">
                {weightChartData.bars.map((bar) => (
                  <div key={bar.label} className="flex flex-col items-center gap-1 flex-1">
                    <div className="text-[11px] text-text2 font-medium">{bar.value} kg</div>
                    <div
                      className="w-full rounded-sm bg-accent-bg border border-accent-br transition-all"
                      style={{ height: `${Math.max(bar.pct, 10)}%` }}
                    />
                    <div className="text-[11px] text-text3">{bar.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-border my-3.5" />

          {/* Section heading: Recent Activity */}
          <h2 className="text-[22px] font-semibold tracking-tight text-text mb-2">
            Nedávná aktivita
          </h2>

          {/* Activity Timeline */}
          {activityItems.length > 0 ? (
            <ActivityTimeline items={activityItems} />
          ) : (
            <p className="text-[13px] text-text3">Žádná nedávná aktivita</p>
          )}

          {/* Nutrition Targets Section (when onboarding data exists) */}
          {ob && ob.bmr != null && (
            <>
              <div className="h-px bg-border my-3.5" />
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[22px] font-semibold tracking-tight text-text">
                  {t('clients.nutritionTargets') !== 'clients.nutritionTargets' ? t('clients.nutritionTargets') : 'Nutriční cíle'}
                </h2>
                <div className="flex gap-1.5">
                  <Button onClick={() => setGoalsDialogOpen(true)}>
                    🔄 {t('clients.recalculate') !== 'clients.recalculate' ? t('clients.recalculate') : 'Přepočítat'}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => existingPlan ? navigate(`/plans/${existingPlan.planId}`) : setPlanDialogOpen(true)}
                  >
                    {existingPlan
                      ? (t('clients.nutritionPlans') !== 'clients.nutritionPlans' ? t('clients.nutritionPlans') : 'Jídelníček')
                      : (t('clients.createPlan') !== 'clients.createPlan' ? t('clients.createPlan') : 'Vytvořit plán')
                    }
                  </Button>
                </div>
              </div>

              {/* BMR -> TDEE -> Adjusted flow */}
              <div className="rounded-md border border-border p-4 mb-4">
                <div className="flex items-center gap-3 text-sm mb-4">
                  <div className="rounded-md bg-accent-bg border border-accent-br px-3.5 py-2.5 text-center">
                    <span className="text-[11px] text-text3 block">BMR</span>
                    <span className="text-[15px] font-bold text-accent">{result?.bmr ?? ob.bmr} kcal</span>
                  </div>
                  <span className="text-text3">&rarr;</span>
                  <div className="rounded-md bg-accent-bg border border-accent-br px-3.5 py-2.5 text-center">
                    <span className="text-[11px] text-text3 block">TDEE</span>
                    <span className="text-[15px] font-bold text-accent">{result?.tdee ?? ob.tdee} kcal</span>
                  </div>
                  <span className="text-text3">&rarr;</span>
                  <div className="rounded-md bg-accent-bg border border-accent-br px-3.5 py-2.5 text-center">
                    <span className="text-[11px] text-text3 block">Cíl</span>
                    <span className="text-[15px] font-bold text-accent">{result?.adjustedKcal ?? ob.adjustedKcal} kcal</span>
                  </div>
                </div>

                {/* Macros */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md bg-blue-bg px-3 py-3 text-center">
                    <span className="text-[11px] text-blue block">Bílkoviny</span>
                    <span className="text-lg font-bold text-blue">
                      {result?.macroTargets.proteinGrams ?? ob.proteinGrams}g
                    </span>
                  </div>
                  <div className="rounded-md bg-orange-bg px-3 py-3 text-center">
                    <span className="text-[11px] text-orange block">Sacharidy</span>
                    <span className="text-lg font-bold text-orange">
                      {result?.macroTargets.carbsGrams ?? ob.carbsGrams}g
                    </span>
                  </div>
                  <div className="rounded-md bg-purple-bg px-3 py-3 text-center">
                    <span className="text-[11px] text-purple block">Tuky</span>
                    <span className="text-lg font-bold text-purple">
                      {result?.macroTargets.fatGrams ?? ob.fatGrams}g
                    </span>
                  </div>
                </div>
              </div>

              {/* Macro Sliders + Meal Distribution */}
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
                    <div className="rounded-md border border-border p-4 mb-4">
                      <MacroSliders
                        proteinPercent={macros.protein}
                        carbsPercent={macros.carbs}
                        fatPercent={macros.fat}
                        totalKcal={activeKcal}
                        onChange={handleMacroChange}
                      />
                    </div>
                    <div className="rounded-md border border-border p-4 mb-4">
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
        </div>
      </div>

      {/* Edit Client Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        title="Upravit profil"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>
              Zrušit
            </Button>
            <Button variant="primary" onClick={() => setEditDialogOpen(false)}>
              Uložit
            </Button>
          </>
        }
      >
        <div className="space-y-0">
          <Input
            label="Jméno"
            defaultValue={client?.firstName ?? ''}
            placeholder="Jméno"
          />
          <Input
            label="Příjmení"
            defaultValue={client?.lastName ?? ''}
            placeholder="Příjmení"
          />
          <Input
            label="Email"
            defaultValue={client?.email ?? ''}
            placeholder="Email"
            type="email"
          />
          <Input
            label="Výška (cm)"
            defaultValue={client?.heightCm?.toString() ?? ''}
            placeholder="168"
            type="number"
          />
          <Input
            label="Váha (kg)"
            defaultValue={client?.weightKg?.toString() ?? ''}
            placeholder="63"
            type="number"
          />
        </div>
      </Dialog>

      {/* Nutrition Goals Dialog */}
      <Dialog
        open={goalsDialogOpen}
        onClose={() => setGoalsDialogOpen(false)}
        title={t('nutritionGoals.title') !== 'nutritionGoals.title' ? t('nutritionGoals.title') : 'Nutriční cíle'}
        maxWidth={600}
      >
        {client && (
          <div className="space-y-4">
            <AnamnesisForm
              client={client}
              onSubmit={handleCalculate}
              isLoading={isCalculating}
            />
          </div>
        )}
      </Dialog>

      {/* Create Plan Dialog */}
      <Dialog
        open={planDialogOpen}
        onClose={() => setPlanDialogOpen(false)}
        title={t('clients.createPlan') !== 'clients.createPlan' ? t('clients.createPlan') : 'Vytvořit plán'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPlanDialogOpen(false)}>
              Zrušit
            </Button>
            <Button
              variant="primary"
              disabled={creatingPlan || !planName.trim()}
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleCreatePlan(e as unknown as React.FormEvent)}
            >
              {creatingPlan
                ? (t('nutrition.saving') !== 'nutrition.saving' ? t('nutrition.saving') : 'Ukládání...')
                : (t('clients.createPlan') !== 'clients.createPlan' ? t('clients.createPlan') : 'Vytvořit plán')
              }
            </Button>
          </>
        }
      >
        <form id="create-plan-form" onSubmit={handleCreatePlan}>
          <Input
            label={t('nutrition.planName') !== 'nutrition.planName' ? t('nutrition.planName') : 'Název plánu'}
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder={t('nutrition.planNamePlaceholder') !== 'nutrition.planNamePlaceholder' ? t('nutrition.planNamePlaceholder') : 'Např. Jídelníček březen'}
            required
          />
          <Input
            label={t('nutrition.weekCount') !== 'nutrition.weekCount' ? t('nutrition.weekCount') : 'Počet týdnů'}
            type="number"
            min={1}
            max={52}
            value={planWeeks}
            onChange={(e) => setPlanWeeks(Math.max(1, Number(e.target.value) || 1))}
          />
        </form>
      </Dialog>

      {/* Confirm Action Dialog */}
      <Dialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction === 'save'
            ? (t('clients.confirmSaveTitle') !== 'clients.confirmSaveTitle' ? t('clients.confirmSaveTitle') : 'Uložit změny?')
            : (t('clients.confirmResetTitle') !== 'clients.confirmResetTitle' ? t('clients.confirmResetTitle') : 'Resetovat změny?')
        }
        maxWidth={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>
              {t('common.cancel') !== 'common.cancel' ? t('common.cancel') : 'Zrušit'}
            </Button>
            <Button
              variant={confirmAction === 'save' ? 'primary' : 'danger'}
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === 'save') handleSave();
                else handleReset();
              }}
            >
              {confirmAction === 'save'
                ? (t('clients.saveTargets') !== 'clients.saveTargets' ? t('clients.saveTargets') : 'Uložit')
                : (t('clients.resetTargets') !== 'clients.resetTargets' ? t('clients.resetTargets') : 'Resetovat')
              }
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-text2">
          {confirmAction === 'save'
            ? (t('clients.confirmSaveMessage') !== 'clients.confirmSaveMessage' ? t('clients.confirmSaveMessage') : 'Opravdu chcete uložit všechny změny?')
            : (t('clients.confirmResetMessage') !== 'clients.confirmResetMessage' ? t('clients.confirmResetMessage') : 'Opravdu chcete zahodit všechny neuložené změny?')
          }
        </p>
      </Dialog>
    </div>
  );
}

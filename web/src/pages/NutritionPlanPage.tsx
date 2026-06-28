import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNutritionPlanStore } from '@/stores/nutritionPlan';
import { getPlan, completePlan } from '@/api/plans';
import { computeNutritionPlanLocks } from '@/lib/nutrition-plan-locks';
import { deriveDayCompletionState, deriveMealCompletionState } from '@/lib/completionState';
import { CompletionBadge } from '@/components/common/CompletionBadge';
import { PlanQuestionnairePanel } from '@/components/questionnaire/PlanQuestionnairePanel';
import { getClientDashboard } from '@/api/nutrition-goals';
import { PageHeader } from '@/components/layout';
import { Button, Dialog } from '@/components/ui';
import { MondayDatePicker } from '@/components/ui/MondayDatePicker';
import { MacroSidebar, WeekDayTabs } from '@/components/nutrition';
import { SupplementsSection } from '@/components/nutrition/SupplementsSection';
import type { WeekTabData, DayTabData } from '@/components/nutrition/WeekDayTabs';
import type { PlanMeal, MealFood, NutrientTotals } from '@/api/plan-types';
import { SortableMealItem } from '@/components/nutrition/SortableMealItem';
import { ShoppingListDrawer } from '@/components/nutrition/ShoppingListDrawer';
import { PublishWeekDialog, CompletePlanDialog, AddMealDialog } from '@/components/nutrition/PlanDialogs';
import { RequestDiaryDialog } from '@/components/diary/RequestDiaryDialog';
import { listDiaryRequests } from '@/api/diary-requests';
import { showSuccess, showApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import { type MealKind } from '@/components/nutrition/meal-kind';
import { DayNoteInput } from '@/components/common/DayNoteInput';
import { CheckInBanner } from '@/components/weekly-checkin/CheckInBanner';
import { PlanPhotosTab } from '@/components/photos/PlanPhotosTab';

export default function NutritionPlanPage() {
  const { t, i18n } = useTranslation();
  const { planId } = useParams<{ planId: string }>();

  // ── Zustand store ──
  const plan = useNutritionPlanStore((s) => s.plan);
  const isDirty = useNutritionPlanStore((s) => s.isDirty);
  const isSaving = useNutritionPlanStore((s) => s.isSaving);
  const selectedWeek = useNutritionPlanStore((s) => s.selectedWeek);
  const setPlan = useNutritionPlanStore((s) => s.setPlan);
  const setSelectedWeek = useNutritionPlanStore((s) => s.setSelectedWeek);
  const save = useNutritionPlanStore((s) => s.save);
  const publishWeek = useNutritionPlanStore((s) => s.publishWeek);
  const addMeal = useNutritionPlanStore((s) => s.addMeal);
  const addWeek = useNutritionPlanStore((s) => s.addWeek);
  const removeWeek = useNutritionPlanStore((s) => s.removeWeek);
  const setStartDate = useNutritionPlanStore((s) => s.setStartDate);
  const removeMeal = useNutritionPlanStore((s) => s.removeMeal);
  const updateFoodAmount = useNutritionPlanStore((s) => s.updateFoodAmount);
  const removeFoodFromMeal = useNutritionPlanStore((s) => s.removeFoodFromMeal);
  const addFoodToMeal = useNutritionPlanStore((s) => s.addFoodToMeal);

  const reorderMeals = useNutritionPlanStore((s) => s.reorderMeals);
  const updateMealNote = useNutritionPlanStore((s) => s.updateMealNote);
  const updateFoodNote = useNutritionPlanStore((s) => s.updateFoodNote);
  const updateDayNote = useNutritionPlanStore((s) => s.updateDayNote);
  const addRecipeToMeal = useNutritionPlanStore((s) => s.addRecipeToMeal);
  const removeRecipeFromMeal = useNutritionPlanStore((s) => s.removeRecipeFromMeal);
  const updateRecipeServings = useNutritionPlanStore((s) => s.updateRecipeServings);
  const updateRecipeNote = useNutritionPlanStore((s) => s.updateRecipeNote);
  const moveFoodToMeal = useNutritionPlanStore((s) => s.moveFoodToMeal);
  const moveRecipeToMeal = useNutritionPlanStore((s) => s.moveRecipeToMeal);
  const moveFoodToDay = useNutritionPlanStore((s) => s.moveFoodToDay);
  const moveRecipeToDay = useNutritionPlanStore((s) => s.moveRecipeToDay);
  const reorderFoodsInMeal = useNutritionPlanStore((s) => s.reorderFoodsInMeal);
  const updateMealTime = useNutritionPlanStore((s) => s.updateMealTime);
  const reorderWeeks = useNutritionPlanStore((s) => s.reorderWeeks);
  const moveMealToDay = useNutritionPlanStore((s) => s.moveMealToDay);
  const setSupplements = useNutritionPlanStore((s) => s.setSupplements);

  // ── Local UI state ──
  const [pageTab, setPageTab] = useState<'meals' | 'photos'>('meals');
  const [selectedDay, setSelectedDay] = useState(1);
  const [weekViewExpanded, setWeekViewExpanded] = useState(false);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const dayHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openMeals, setOpenMeals] = useState<Set<string>>(new Set());
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [newMealKind, setNewMealKind] = useState<MealKind>('Breakfast');
  const [newMealTime, setNewMealTime] = useState('');
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);

  // Same query the Photos tab + DiaryViewerPanel use — TanStack dedupes by key
  // so this fires zero extra requests once any of those have already loaded.
  // Used to disable the sidebar "send request" button while a request is
  // already in flight (Pending / Accepted / InProgress) for this plan.
  const { data: planDiaryRequests = [] } = useQuery({
    queryKey: ['diary-requests', planId],
    queryFn: () => listDiaryRequests({ planId: planId! }),
    enabled: !!planId,
    staleTime: 30_000,
  });
  const hasInFlightDiary = planDiaryRequests.some(
    (r) => r.status === 'Pending' || r.status === 'Accepted' || r.status === 'InProgress',
  );
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // ── Load plan ──
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    setLoadError(false);
    (async () => {
      try {
        const data = await getPlan(planId);
        if (!cancelled) setPlan(data);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [planId, setPlan]);

  // ── Client dashboard for targets ──
  const { data: clientDashboard } = useQuery({
    queryKey: ['client-dashboard', plan?.clientId],
    queryFn: () => getClientDashboard(plan!.clientId),
    enabled: !!plan?.clientId,
  });

  const targets = useMemo(() => {
    const gs = plan?.globalSettings;
    const ob = clientDashboard?.onboarding;
    return {
      kcal: gs?.dailyKcal ?? ob?.adjustedKcal ?? 2000,
      protein: gs?.proteinGrams ?? 130,
      carbs: gs?.carbsGrams ?? 180,
      fat: gs?.fatGrams ?? 55,
      fiber: gs?.fiberGrams ?? ob?.fiberGrams ?? 25,
    };
  }, [plan?.globalSettings, clientDashboard]);

  // ── Nutrition plan locks (eaten meals) ──
  const mealLogs = plan?.mealLogs ?? [];
  const planLocks = useMemo(
    () => computeNutritionPlanLocks(plan ?? null, mealLogs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, mealLogs],
  );

  // ── Warn before unload ──
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Block in-app navigation when dirty ──
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  // Intercept back/forward browser buttons
  useEffect(() => {
    if (!isDirty) return;
    const handler = () => {
      // Push current URL back to prevent leaving
      window.history.pushState(null, '', location.pathname + location.search);
      setPendingNav('__back__');
    };
    window.addEventListener('popstate', handler);
    // Push an extra entry so popstate fires before actually leaving
    window.history.pushState(null, '', location.pathname + location.search);
    return () => window.removeEventListener('popstate', handler);
  }, [isDirty, location.pathname, location.search]);

  // Monkey-patch pushState to intercept programmatic navigation
  useEffect(() => {
    if (!isDirty) return;
    const origPush = window.history.pushState.bind(window.history);
    const currentPath = location.pathname + location.search;
    window.history.pushState = function (...args: Parameters<typeof origPush>) {
      const url = typeof args[2] === 'string' ? args[2] : '';
      if (url && url !== currentPath && !url.startsWith(currentPath + '#')) {
        setPendingNav(url);
        return; // block the navigation
      }
      return origPush(...args);
    };
    return () => { window.history.pushState = origPush; };
  }, [isDirty, location.pathname, location.search]);

  const confirmLeave = () => {
    const target = pendingNav;
    setPendingNav(null);
    // Temporarily clear dirty to allow navigation
    useNutritionPlanStore.setState({ isDirty: false });
    if (target === '__back__') {
      window.history.back();
    } else if (target) {
      navigate(target);
    }
  };

  // No auto-save — save only on explicit button click

  // ── Open all meals of the current day on first load ──
  useEffect(() => {
    if (!plan) return;
    const week = plan.weeks.find((w) => w.weekNumber === selectedWeek);
    const day = week?.days.find((d) => d.dayOfWeek === selectedDay);
    if (day) {
      setOpenMeals(new Set(day.meals.map((m) => m.mealId)));
    }
  }, [plan, selectedWeek, selectedDay]);

  // ── Handlers ──
  const handleSave = async () => {
    try {
      await save();
      showSuccess(t('nutrition.planSaved'));
    } catch (err) {
      showApiError(err, 'nutrition.versionConflict');
    }
  };

  const handleReset = async () => {
    if (!planId) return;
    try {
      const data = await getPlan(planId);
      setPlan(data);
    } catch (err) {
      showApiError(err, 'common.error');
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await publishWeek(selectedWeek);
      setPublishDialogOpen(false);
      showSuccess(t('nutrition.weekPublished_success', { number: selectedWeek }));
    } catch (err) {
      showApiError(err, 'common.error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleComplete = async () => {
    if (!plan || !planId) return;
    setIsCompleting(true);
    try {
      const updated = await completePlan(planId, plan.version);
      setPlan(updated);
      setCompleteDialogOpen(false);
      showSuccess(t('nutrition.planCompleted'));
    } catch (err) {
      showApiError(err, 'common.error');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleAddMeal = () => {
    if (!plan) return;
    const week = plan.weeks.find((w) => w.weekNumber === selectedWeek);
    const day = week?.days.find((d) => d.dayOfWeek === selectedDay);
    const order = (day?.meals.length ?? 0) + 1;
    const meal: PlanMeal = {
      mealId: crypto.randomUUID(),
      kind: newMealKind,
      order,
      time: newMealTime || null,
      foods: [],
      recipes: [],
      mealTotals: null,
    };
    addMeal(selectedWeek, selectedDay, meal);
    setOpenMeals((prev) => new Set([...prev, meal.mealId]));
    setNewMealKind('Breakfast');
    setNewMealTime('');
    setAddMealOpen(false);
  };

  const handleToggleMeal = useCallback((mealId: string) => {
    setOpenMeals((prev) => {
      const next = new Set(prev);
      if (next.has(mealId)) next.delete(mealId);
      else next.add(mealId);
      return next;
    });
  }, []);

  const handleFoodSelect = useCallback(
    (mealId: string, food: { name: string; nameCs?: string | null; nameEn?: string | null; nameDe?: string | null; foodId?: string; kcal: number; protein: number; carbs: number; fat: number; category?: string | null }) => {
      if (!plan) return;
      const mealFood: MealFood = {
        foodExternalId: food.foodId || crypto.randomUUID(),
        foodName: food.name,
        foodNameCs: food.nameCs,
        foodNameEn: food.nameEn,
        foodNameDe: food.nameDe,
        foodCategory: food.category,
        nutrientValuePer100Grams: {
          kcal: food.kcal,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
        },
        amountGrams: 100,
      };
      addFoodToMeal(selectedWeek, selectedDay, mealId, mealFood);
    },
    [plan, selectedWeek, selectedDay, addFoodToMeal],
  );

  // ── Derived data ──
  const currentWeek = plan?.weeks.find((w) => w.weekNumber === selectedWeek) ?? plan?.weeks[0];
  const isWeekPublished = currentWeek?.status === 'Published';
  const currentDay = currentWeek?.days.find((d) => d.dayOfWeek === selectedDay);
  const meals = useMemo(
    () => (currentDay?.meals ?? []).slice().sort((a, b) => a.order - b.order),
    [currentDay],
  );

  const dayTotals: NutrientTotals = currentDay?.dayTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

  // ── Week/Day tabs data ──
  const weekTabs: WeekTabData[] = useMemo(() => {
    if (!plan) return [];
    return plan.weeks.map((w) => {
      // Nutrition plans don't (yet) gate edits on the week-end date — preserve
      // the existing "published → green check" behavior by mapping straight to
      // `isFinished`.
      return {
        index: w.weekNumber,
        label: t('nutrition.weekLabel', { number: w.weekNumber }),
        isFinished: w.status === 'Published',
      };
    });
  }, [plan, t]);

  const dayTabs: DayTabData[] = useMemo(() => {
    if (!currentWeek) return [];
    const dayKeys = ['nutrition.mon', 'nutrition.tue', 'nutrition.wed', 'nutrition.thu', 'nutrition.fri', 'nutrition.sat', 'nutrition.sun'];
    return dayKeys.map((key, idx) => {
      const dayOfWeek = idx + 1;
      const day = currentWeek.days.find((d) => d.dayOfWeek === dayOfWeek);
      const kcal = day?.dayTotals?.kcal ?? 0;
      return {
        index: dayOfWeek,
        label: t(key),
        badge: kcal > 0 ? `${Math.round(kcal)} kcal` : '—',
      };
    });
  }, [currentWeek, t]);

  // ── Loading / error state ──
  if (!plan) {
    return (
      <div className="flex items-center justify-center text-text3" style={{ height: '100vh' }}>
        {loadError ? t('common.loadError') : t('common.loading')}
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100vh' }}>
      {/* ── Header ── */}
      <div className="shrink-0">
      <PageHeader
        icon="🥗"
        title={t('nutrition.tabMealPlan')}
        subtitle={`${clientDashboard ? `${clientDashboard.firstName} ${clientDashboard.lastName}` : '...'} · ${t('nutrition.planSubtitle')}`}
        actions={
          <div className="flex items-center gap-1.5">
            {isDirty && (
              <span style={{ fontSize: 11, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--orange)' }} />
                {t('nutrition.unsavedWarning')}
              </span>
            )}
            {isSaving && (
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t('nutrition.saving')}</span>
            )}
            <Button variant="default" size="sm" onClick={() => setResetConfirmOpen(true)} disabled={!isDirty}>
              {t('nutrition.discardChanges')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
              {t('nutrition.save')}
            </Button>
            {plan?.status === 'Active' && (
              <Button variant="brand" size="sm" onClick={() => setCompleteDialogOpen(true)} disabled={isDirty}>
                {t('nutrition.completePlan')}
              </Button>
            )}
          </div>
        }
      />
      </div>

      {/* ── Weekly check-in banner ── */}
      {plan.clientId && (
        <CheckInBanner clientUserId={plan.clientId} profession="Nutrition" />
      )}

      {/* ── Page-level tabs: Meals / Photos ── */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-border bg-bg">
        <button
          type="button"
          onClick={() => setPageTab('meals')}
          className={cn(
            'px-3 py-1 rounded-full text-[12px] font-medium transition-colors border',
            pageTab === 'meals'
              ? 'bg-accent text-bg border-accent'
              : 'bg-bg2 text-text3 border-border hover:bg-bg3 hover:text-text2',
          )}
        >
          {t('nutrition.tabMealPlan')}
        </button>
        <button
          type="button"
          onClick={() => setPageTab('photos')}
          className={cn(
            'px-3 py-1 rounded-full text-[12px] font-medium transition-colors border',
            pageTab === 'photos'
              ? 'bg-accent text-bg border-accent'
              : 'bg-bg2 text-text3 border-border hover:bg-bg3 hover:text-text2',
          )}
        >
          {t('nutrition.photos.tab')}
        </button>

        {/* Right side: start date + add-week */}
        <div className="ml-auto flex items-center gap-1.5 text-text3">
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-[12px] font-medium">{t('nutrition.planStartDate')}</span>
          <MondayDatePicker
            value={plan.startDate?.split('T')[0] ?? null}
            onChange={(val) => setStartDate(val)}
            placeholder="—"
            className="rounded-md border border-border bg-bg px-2.5 py-1 text-[12px] text-text outline-none transition-colors hover:border-border-md focus:border-border-hv"
            style={{ width: 120 }}
          />
          {pageTab === 'meals' && (
            <Button variant="default" size="sm" onClick={addWeek} title={t('nutrition.addWeek')} className="ml-1">
              {t('nutrition.addWeek')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Photos tab content ── */}
      {pageTab === 'photos' && planId && (
        <div className="flex-1 overflow-hidden">
          <PlanPhotosTab
            planId={planId}
            clientId={plan.clientId}
            clientName={
              clientDashboard
                ? `${clientDashboard.firstName} ${clientDashboard.lastName}`
                : undefined
            }
            linkId={clientDashboard?.linkId}
          />
        </div>
      )}

      {/* ── Meals tab content ── */}
      {pageTab === 'meals' && <>
      <WeekDayTabs
        weeks={weekTabs}
        days={[]}
        selectedWeek={selectedWeek}
        selectedDay={selectedDay}
        onWeekChange={setSelectedWeek}
        onDayChange={setSelectedDay}
        onRemoveWeek={removeWeek}
        onReorderWeeks={reorderWeeks}
      />

      {/* ── Two-column body ── */}
      <div className="flex-1 overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '1fr 256px' }}>
        {/* Left: Day tabs + Meals */}
        <div className="flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--border)', minWidth: 0 }}>
          {/* Day tabs inside meals column */}
          <div className="relative flex items-center border-b border-border shrink-0">
            {dayTabs.map((day) => (
              <button
                key={day.index}
                type="button"
                onClick={() => setSelectedDay(day.index)}
                onDragOver={(e) => {
                  const hasMeal = e.dataTransfer.types.includes('application/meal-json');
                  const hasItem = e.dataTransfer.types.includes('application/json');
                  if (!hasMeal && !hasItem) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverDay !== day.index) {
                    setDragOverDay(day.index);
                    if (dayHoverTimer.current) clearTimeout(dayHoverTimer.current);
                    dayHoverTimer.current = setTimeout(() => {
                      setSelectedDay(day.index);
                    }, 500);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverDay === day.index) {
                    setDragOverDay(null);
                    if (dayHoverTimer.current) { clearTimeout(dayHoverTimer.current); dayHoverTimer.current = null; }
                  }
                }}
                onDrop={(e) => {
                  setDragOverDay(null);
                  if (dayHoverTimer.current) { clearTimeout(dayHoverTimer.current); dayHoverTimer.current = null; }
                  // Only handle direct meal drops on tabs (food/recipe drops go to MealDropZone after tab switch)
                  if (!e.dataTransfer.types.includes('application/meal-json')) return;
                  e.preventDefault();
                  try {
                    const data = JSON.parse(e.dataTransfer.getData('application/meal-json'));
                    if (data.type === 'meal' && data.mealId) {
                      const fromDay = data.fromDay ?? selectedDay;
                      const fromWeek = data.fromWeek ?? selectedWeek;
                      if (fromDay !== day.index || fromWeek !== selectedWeek) {
                        moveMealToDay(selectedWeek, fromDay, day.index, data.mealId, 999, fromWeek);
                        setSelectedDay(day.index);
                      }
                    }
                  } catch { /* ignore */ }
                }}
                style={{
                  flex: 1, border: 'none', fontFamily: 'inherit',
                  borderBottom: day.index === selectedDay ? '2px solid var(--text)' : '2px solid transparent',
                  marginBottom: -1, padding: '7px 0', fontSize: 12,
                  color: day.index === selectedDay ? 'var(--text)' : 'var(--text3)',
                  fontWeight: day.index === selectedDay ? 500 : 400,
                  cursor: 'pointer', textAlign: 'center' as const, whiteSpace: 'nowrap' as const,
                  transition: 'color 0.1s, background 0.15s',
                  background: dragOverDay === day.index ? 'var(--accent-bg)' : 'none',
                }}
              >
                {day.label}
                {day.badge && (
                  <span
                    className={cn(
                      'text-[10px] rounded-full px-[5px] ml-1',
                      'bg-accent-bg text-accent',
                    )}
                  >
                    {day.badge}
                  </span>
                )}
                {(() => {
                  const dayData = currentWeek?.days.find((d) => d.dayOfWeek === day.index);
                  const dayMealIds = (dayData?.meals ?? []).map((m) => m.mealId);
                  const { state: dayState, counts: dayCounts } = deriveDayCompletionState(mealLogs, dayMealIds);
                  if (dayState === 'not-touched') return null;
                  return (
                    <span className="ml-1 inline-flex">
                      <CompletionBadge kind="day" state={dayState} counts={dayCounts} />
                    </span>
                  );
                })()}
              </button>
            ))}
            {/* Expand week overview toggle */}
            <button
              type="button"
              className="shrink-0 px-2 text-text3 hover:text-text transition-colors"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}
              onClick={() => setWeekViewExpanded((v) => !v)}
              title={weekViewExpanded ? t('nutrition.collapseWeekView') : t('nutrition.expandWeekView')}
            >
              {weekViewExpanded ? '⊟' : '⊞'}
            </button>

            {/* ── Expandable week overview ── */}
            {weekViewExpanded && (
            <div
              className="absolute left-0 right-0 top-full z-50 border-b border-border bg-bg"
              style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
            >
              <div className="grid grid-cols-7 gap-0">
                {[1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => {
                  const day = currentWeek?.days.find((d) => d.dayOfWeek === dayOfWeek);
                  const dayMeals = (day?.meals ?? []).slice().sort((a, b) => a.order - b.order);
                  const isSelected = dayOfWeek === selectedDay;

                  return (
                    <div
                      key={dayOfWeek}
                      className={cn(
                        'flex flex-col border-r border-border last:border-r-0 cursor-pointer',
                        isSelected && 'bg-accent-bg',
                      )}
                      onClick={() => { setSelectedDay(dayOfWeek); setWeekViewExpanded(false); }}
                    >
                      <div className="p-1.5 flex flex-col gap-1" style={{ minHeight: 60 }}>
                        {dayMeals.length === 0 && (
                          <div className="text-[10px] text-text4 text-center py-3">—</div>
                        )}
                        {dayMeals.map((meal) => {
                          const mealKcal = meal.foods.reduce((s, f) => {
                            const scale = f.amountGrams / 100;
                            return s + f.nutrientValuePer100Grams.kcal * scale;
                          }, 0) + (meal.recipes ?? []).reduce((s, r) => s + r.nutrientValuePerServing.kcal * r.servings, 0);
                          const mealP = meal.foods.reduce((s, f) => s + f.nutrientValuePer100Grams.protein * (f.amountGrams / 100), 0)
                            + (meal.recipes ?? []).reduce((s, r) => s + r.nutrientValuePerServing.protein * r.servings, 0);
                          const mealC = meal.foods.reduce((s, f) => s + f.nutrientValuePer100Grams.carbs * (f.amountGrams / 100), 0)
                            + (meal.recipes ?? []).reduce((s, r) => s + r.nutrientValuePerServing.carbs * r.servings, 0);
                          const mealF = meal.foods.reduce((s, f) => s + f.nutrientValuePer100Grams.fat * (f.amountGrams / 100), 0)
                            + (meal.recipes ?? []).reduce((s, r) => s + r.nutrientValuePerServing.fat * r.servings, 0);

                          return (
                            <div
                              key={meal.mealId}
                              className={cn(
                                'rounded-md border bg-bg p-1.5',
                                isSelected ? 'border-border-md' : 'border-border',
                              )}
                            >
                              <div className="text-[11px] font-semibold text-text truncate">{t(`mealKind.${meal.kind}`)}</div>
                              <div className="text-[10px] text-text3 mt-0.5">
                                {meal.foods.length + (meal.recipes ?? []).length} {t('nutrition.itemsCount')}
                              </div>
                              {(meal.foods.length > 0 || (meal.recipes ?? []).length > 0) && (
                                <div className="flex items-center gap-1.5 mt-1 text-[9px] tabular-nums">
                                  <span className="font-semibold text-text2">{Math.round(mealKcal)}</span>
                                  <span style={{ color: 'var(--blue)' }}>{Math.round(mealP)}{t('nutrition.proteinShort')}</span>
                                  <span style={{ color: 'var(--orange)' }}>{Math.round(mealC)}{t('nutrition.carbsShort')}</span>
                                  <span style={{ color: 'var(--purple)' }}>{Math.round(mealF)}{t('nutrition.fatShort')}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </div>

          <div key={`${selectedWeek}-${selectedDay}`} className="tab-content-transition flex-1 overflow-y-auto" style={{ padding: '12px 20px' }}>
            {/* Day note */}
            <DayNoteInput
              note={currentDay?.note}
              onChange={(n) => updateDayNote(selectedWeek, selectedDay, n)}
              addLabel={t('nutrition.addDayNote')}
              placeholder={t('nutrition.dayNotePlaceholder')}
            />

            <div
              style={{ minHeight: 120, paddingBottom: meals.length > 0 ? 48 : undefined }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/meal-json')) {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => {
                if (!e.dataTransfer.types.includes('application/meal-json')) return;
                e.preventDefault();
                try {
                  const data = JSON.parse(e.dataTransfer.getData('application/meal-json'));
                  if (data.type !== 'meal' || !data.mealId) return;

                  const fromDay = data.fromDay ?? selectedDay;
                  const fromWeek = data.fromWeek ?? selectedWeek;

                  // Find target position from mouse
                  const container = e.currentTarget;
                  const mealEls = Array.from(container.querySelectorAll('[data-meal-id]'));
                  let targetIndex = mealEls.length;
                  for (let i = 0; i < mealEls.length; i++) {
                    const rect = mealEls[i].getBoundingClientRect();
                    if (e.clientY < rect.top + rect.height / 2) {
                      targetIndex = i;
                      break;
                    }
                  }

                  if (fromDay !== selectedDay || fromWeek !== selectedWeek) {
                    // Cross-day/week move
                    moveMealToDay(selectedWeek, fromDay, selectedDay, data.mealId, targetIndex, fromWeek);
                  } else {
                    // Same-day reorder
                    const oldIndex = meals.findIndex((m) => m.mealId === data.mealId);
                    if (oldIndex === -1 || oldIndex === targetIndex) return;
                    const newOrder = [...meals];
                    const [moved] = newOrder.splice(oldIndex, 1);
                    newOrder.splice(targetIndex > oldIndex ? targetIndex - 1 : targetIndex, 0, moved);
                    reorderMeals(selectedWeek, selectedDay, newOrder.map((m) => m.mealId));
                  }
                } catch { /* ignore */ }
              }}
            >
            {meals.length === 0 && (
              <div className="py-12 text-center text-[13px] text-text3">
                {t('nutrition.noMealsMessage')}
              </div>
            )}
            {meals.map((meal, index) => (
              <SortableMealItem
                key={meal.mealId}
                meal={meal}
                index={index}
                dayOfWeek={selectedDay}
                weekNumber={selectedWeek}
                isOpen={openMeals.has(meal.mealId)}
                onToggle={() => handleToggleMeal(meal.mealId)}
                onFoodAmountChange={(foodId, amount) =>
                  updateFoodAmount(selectedWeek, selectedDay, meal.mealId, foodId, amount)
                }
                onFoodRemove={(foodId) =>
                  removeFoodFromMeal(selectedWeek, selectedDay, meal.mealId, foodId)
                }
                onFoodSelect={(food) => handleFoodSelect(meal.mealId, food)}
                onRecipeSelect={(recipe) => addRecipeToMeal(selectedWeek, selectedDay, meal.mealId, {
                  recipeId: recipe.recipeId,
                  recipeName: recipe.name,
                  nutrientValuePerServing: { kcal: recipe.kcal, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat },
                  servings: 1,
                  foodCategories: recipe.foodCategories,
                })}
                onRecipeServingsChange={(recipeId, s) => updateRecipeServings(selectedWeek, selectedDay, meal.mealId, recipeId, s)}
                onRecipeRemove={(recipeId) => removeRecipeFromMeal(selectedWeek, selectedDay, meal.mealId, recipeId)}
                onRecipeNoteChange={(recipeId, n) => updateRecipeNote(selectedWeek, selectedDay, meal.mealId, recipeId, n)}

                onNoteChange={(n) => updateMealNote(selectedWeek, selectedDay, meal.mealId, n)}
                onFoodNoteChange={(foodId, n) => updateFoodNote(selectedWeek, selectedDay, meal.mealId, foodId, n)}
                onItemDrop={(data) => {
                  const sourceDay = data.dayOfWeek ?? selectedDay;
                  const sourceWeek = (data as { weekNumber?: number }).weekNumber ?? selectedWeek;
                  const sameLocation = sourceWeek === selectedWeek && sourceDay === selectedDay;
                  if (data.type === 'food' && data.foodId) {
                    if (sameLocation) {
                      moveFoodToMeal(selectedWeek, selectedDay, data.mealId, meal.mealId, data.foodId);
                    } else {
                      moveFoodToDay(selectedWeek, sourceDay, selectedDay, data.mealId, meal.mealId, data.foodId, sourceWeek);
                    }
                  } else if (data.type === 'recipe' && data.recipeId) {
                    if (sameLocation) {
                      moveRecipeToMeal(selectedWeek, selectedDay, data.mealId, meal.mealId, data.recipeId);
                    } else {
                      moveRecipeToDay(selectedWeek, sourceDay, selectedDay, data.mealId, meal.mealId, data.recipeId, sourceWeek);
                    }
                  }
                }}
                onReorder={(itemIds) => reorderFoodsInMeal(selectedWeek, selectedDay, meal.mealId, itemIds)}
                onTimeChange={(t) => updateMealTime(selectedWeek, selectedDay, meal.mealId, t)}
                onDuplicate={() => {
                  const clone: PlanMeal = {
                    ...meal,
                    mealId: crypto.randomUUID(),
                    kind: meal.kind,
                    order: meals.length + 1,
                  };
                  addMeal(selectedWeek, selectedDay, clone);
                }}
                onRemove={() => removeMeal(selectedWeek, selectedDay, meal.mealId)}
                lang={i18n.language}
                removeMealTitle={t('nutrition.removeMealTitle')}
                removeMealMessage={t('nutrition.removeMealMessage', { name: t(`mealKind.${meal.kind}`) })}
                cancelLabel={t('common.cancel')}
                removeLabel={t('nutrition.remove')}
                locked={planLocks.mealIds.has(meal.mealId)}
                completionState={deriveMealCompletionState(mealLogs, meal.mealId)}
              />
            ))}
            </div>

            {/* Add meal button */}
            <div
              className="flex items-center gap-1.5 px-3 py-2 mt-2 border border-dashed border-border rounded-md cursor-pointer text-text3 text-[13px] transition-colors hover:bg-bg-hover hover:text-text"
              onClick={() => { setNewMealKind('Breakfast'); setNewMealTime(''); setAddMealOpen(true); }}
            >
              <span>+</span>
              <span>{t('nutrition.addMealButton')}</span>
            </div>
          </div>
        </div>

        {/* Right: Macro sidebar */}
        <div className="flex flex-col overflow-y-auto bg-bg2" style={{ scrollbarGutter: 'stable' }}>
          <MacroSidebar totals={dayTotals} targets={targets} />

          {/* Week-scoped actions — shopping list + publish */}
          <div className="p-3 border-t border-border">
            <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-2">
              {t('nutrition.weekLabel', { number: selectedWeek })}
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                variant="default"
                onClick={() => setShoppingListOpen(true)}
                className="flex w-full justify-center"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                {t('nutrition.shoppingList')}
              </Button>
              <Button
                variant="brand"
                onClick={() => setPublishDialogOpen(true)}
                disabled={isWeekPublished || isDirty || plan?.status === 'Completed'}
                className="flex w-full justify-center"
              >
                {isWeekPublished ? t('nutrition.published') : t('nutrition.publishWeekButton')}
              </Button>
              <Button
                variant="default"
                onClick={() => setDiaryDialogOpen(true)}
                disabled={hasInFlightDiary}
                title={hasInFlightDiary ? t('diary.request.alreadyPending') : undefined}
                className="flex w-full justify-center"
              >
                <span className="mr-1">📸</span>
                {t('diary.request.ctaButton')}
              </Button>
            </div>
          </div>

          {/* Plan-level supplement recommendations */}
          <div className="p-3 border-t border-border">
            <SupplementsSection
              supplements={plan.supplements ?? []}
              onChange={setSupplements}
            />
          </div>

          <PlanQuestionnairePanel
            clientId={plan.clientId}
            questionnaireResponseId={plan.questionnaireResponseId}
            planStatus={plan.status}
            ns="nutrition"
          />
        </div>
      </div>
      </>}

      {/* ── Leave Page Confirmation Dialog ── */}
      <Dialog
        open={!!pendingNav}
        onClose={() => setPendingNav(null)}
        title={t('nutrition.leaveTitle')}
        maxWidth={400}
        footer={
          <>
            <Button onClick={() => setPendingNav(null)}>{t('nutrition.stay')}</Button>
            <Button variant="danger" onClick={confirmLeave}>
              {t('nutrition.leaveWithoutSaving')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {t('nutrition.leaveMessage')}
        </p>
      </Dialog>

      {/* ── Publish Week Confirmation Dialog ── */}
      <PublishWeekDialog
        isOpen={publishDialogOpen}
        selectedWeek={selectedWeek}
        isPublishing={isPublishing}
        onPublish={handlePublish}
        onClose={() => setPublishDialogOpen(false)}
      />

      {/* ── Complete Plan Confirmation Dialog ── */}
      <CompletePlanDialog
        isOpen={completeDialogOpen}
        isCompleting={isCompleting}
        onComplete={handleComplete}
        onClose={() => setCompleteDialogOpen(false)}
      />

      {/* ── Photo Diary Request Dialog ── */}
      <RequestDiaryDialog
        open={diaryDialogOpen}
        onClose={() => setDiaryDialogOpen(false)}
        linkId={clientDashboard?.linkId}
        planId={planId}
        clientName={
          clientDashboard
            ? `${clientDashboard.firstName} ${clientDashboard.lastName}`
            : ''
        }
        clientInitials={
          clientDashboard
            ? `${clientDashboard.firstName?.[0] ?? ''}${clientDashboard.lastName?.[0] ?? ''}`.toUpperCase()
            : '?'
        }
      />

      {/* ── Reset Confirmation Dialog ── */}
      <Dialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title={t('nutrition.discardConfirmTitle')}
        maxWidth={380}
        footer={
          <>
            <Button onClick={() => setResetConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => { setResetConfirmOpen(false); handleReset(); }}>
              {t('nutrition.discardChanges')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {t('nutrition.discardConfirmMessage')}
        </p>
      </Dialog>

      {/* ── Add Meal Dialog ── */}
      <AddMealDialog
        isOpen={addMealOpen}
        mealKind={newMealKind}
        mealTime={newMealTime}
        onMealKindChange={setNewMealKind}
        onMealTimeChange={setNewMealTime}
        onAdd={handleAddMeal}
        onClose={() => setAddMealOpen(false)}
      />

      {/* ── Shopping List Drawer ── */}
      <ShoppingListDrawer
        open={shoppingListOpen}
        onClose={() => setShoppingListOpen(false)}
        plan={plan}
        selectedWeek={selectedWeek}
      />
    </div>
  );
}

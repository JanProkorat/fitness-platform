import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNutritionPlanStore } from '@/stores/nutritionPlan';
import { getPlan } from '@/api/plans';
import { getClientDashboard } from '@/api/nutrition-goals';
import { PageHeader } from '@/components/layout';
import { Button, Dialog, Input } from '@/components/ui';
import { MondayDatePicker } from '@/components/ui/MondayDatePicker';
import { MacroSidebar, MealBlock, WeekDayTabs } from '@/components/nutrition';
import type { MealBlockFood } from '@/components/nutrition';
import type { WeekTabData, DayTabData } from '@/components/nutrition/WeekDayTabs';
import type { PlanMeal, MealFood, NutrientTotals } from '@/api/plan-types';
import { showSuccess, showApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';


/** Day-level note input */
function DayNoteInput({ note, onChange, addLabel, placeholder }: { note?: string | null; onChange: (note: string) => void; addLabel: string; placeholder: string }) {
  const [value, setValue] = useState(note ?? '');
  const [open, setOpen] = useState(!!note);

  // Sync when day changes
  useEffect(() => {
    setValue(note ?? '');
    if (note) setOpen(true);
  }, [note]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 8px',
          fontSize: 11, color: 'var(--text4)', fontFamily: 'inherit', transition: 'color 0.1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
      >
        {addLabel}
      </button>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onChange(value)}
        placeholder={placeholder}
        style={{
          width: '100%', border: '1px dashed var(--border-md)', outline: 'none',
          background: 'transparent', fontSize: 12, color: 'var(--text2)',
          fontFamily: 'inherit', fontStyle: 'italic', padding: '5px 8px',
          borderRadius: 'var(--radius-md)', transition: 'border-color 0.15s',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--accent-br)'; }}
        onBlurCapture={(e) => { e.target.style.borderColor = 'var(--border-md)'; }}
      />
    </div>
  );
}

/** Resolve localized food name based on current language */
function resolveLocalizedName(food: { foodName: string; foodNameCs?: string | null; foodNameEn?: string | null; foodNameDe?: string | null }, lang: string): string {
  if (lang.startsWith('cs') && food.foodNameCs) return food.foodNameCs;
  if (lang.startsWith('de') && food.foodNameDe) return food.foodNameDe;
  if (lang.startsWith('en') && food.foodNameEn) return food.foodNameEn;
  return food.foodName;
}

/** Sortable wrapper for a meal in the day list */
function SortableMealItem({
  meal,
  index: _index,
  dayOfWeek,
  weekNumber: weekNum,
  isOpen,
  onToggle,
  onFoodAmountChange,
  onFoodRemove,
  onFoodSelect,
  onRecipeSelect,
  onRecipeServingsChange,
  onRecipeRemove,
  onRecipeNoteChange,
  onNameChange,
  onNoteChange,
  onFoodNoteChange,
  onItemDrop,
  onReorder,
  onTimeChange,
  onDuplicate,
  onRemove,
  lang,
  removeMealTitle,
  removeMealMessage,
  cancelLabel,
  removeLabel,
}: {
  meal: PlanMeal;
  index: number;
  dayOfWeek: number;
  weekNumber: number;
  isOpen: boolean;
  onToggle: () => void;
  onFoodAmountChange: (foodId: string, amount: number) => void;
  onFoodRemove: (foodId: string) => void;
  onFoodSelect: (food: { name: string; kcal: number; protein: number; carbs: number; fat: number }) => void;
  onRecipeSelect: (recipe: { recipeId: string; name: string; kcal: number; protein: number; carbs: number; fat: number }) => void;
  onRecipeServingsChange: (recipeId: string, servings: number) => void;
  onRecipeRemove: (recipeId: string) => void;
  onRecipeNoteChange: (recipeId: string, note: string) => void;
  onNameChange: (name: string) => void;
  onNoteChange: (note: string) => void;
  onFoodNoteChange: (foodId: string, note: string) => void;
  onItemDrop: (data: { type: string; foodId?: string; recipeId?: string; mealId: string; dayOfWeek?: number }) => void;
  onReorder: (itemIds: string[]) => void;
  onTimeChange: (time: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  lang: string;
  removeMealTitle: string;
  removeMealMessage: string;
  cancelLabel: string;
  removeLabel: string;
}) {

  const mealFoods: MealBlockFood[] = meal.foods.map((f) => {
    const scale = f.amountGrams / 100;
    return {
      id: f.foodExternalId,
      name: resolveLocalizedName(f, lang),
      amount: f.amountGrams,
      unit: 'g',
      kcal: f.nutrientValuePer100Grams.kcal * scale,
      protein: f.nutrientValuePer100Grams.protein * scale,
      carbs: f.nutrientValuePer100Grams.carbs * scale,
      fat: f.nutrientValuePer100Grams.fat * scale,
      note: f.note,
      category: f.foodCategory,
    };
  });

  const mealRecipes = (meal.recipes ?? []).map((r) => ({
    recipeId: r.recipeId,
    recipeName: r.recipeName,
    servings: r.servings,
    kcal: r.nutrientValuePerServing.kcal,
    protein: r.nutrientValuePerServing.protein,
    carbs: r.nutrientValuePerServing.carbs,
    fat: r.nutrientValuePerServing.fat,
    note: r.note,
  }));

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [mealOver, setMealOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/meal-json', JSON.stringify({ type: 'meal', mealId: meal.mealId, fromDay: dayOfWeek, fromWeek: weekNum }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        // Only accept meal drags (not food/recipe)
        if (e.dataTransfer.types.includes('application/meal-json')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setMealOver(true);
        }
      }}
      onDragLeave={() => setMealOver(false)}
      onDrop={(e) => {
        setMealOver(false);
        if (!e.dataTransfer.types.includes('application/meal-json')) return;
        e.preventDefault();
        // meal reorder handled by parent
      }}
      data-meal-id={meal.mealId}
      style={{
        borderTop: mealOver ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'border-color 0.1s',
      }}
    >
      <MealBlock
        mealId={meal.mealId}
        dayOfWeek={dayOfWeek}
        weekNumber={weekNum}
        name={meal.name}
        time={meal.time ?? undefined}
        note={meal.note}
        foods={mealFoods}
        recipes={mealRecipes}
        isOpen={isOpen}
        onToggle={onToggle}
        onFoodAmountChange={onFoodAmountChange}
        onFoodRemove={onFoodRemove}
        onFoodNoteChange={onFoodNoteChange}
        onFoodSelect={onFoodSelect}
        onRecipeSelect={onRecipeSelect}
        onRecipeServingsChange={onRecipeServingsChange}
        onRecipeRemove={onRecipeRemove}
        onRecipeNoteChange={onRecipeNoteChange}
        mealTotalKcal={meal.mealTotals?.kcal ?? 0}
        onNameChange={onNameChange}
        onNoteChange={onNoteChange}
        onItemDrop={onItemDrop}
        onReorder={onReorder}
        onTimeChange={onTimeChange}
        onDuplicate={onDuplicate}
        onRemove={() => setConfirmRemove(true)}
      />
      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={removeMealTitle}
        maxWidth={380}
        footer={
          <>
            <Button onClick={() => setConfirmRemove(false)}>{cancelLabel}</Button>
            <Button variant="danger" onClick={() => { setConfirmRemove(false); onRemove(); }}>
              {removeLabel}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {removeMealMessage}
        </p>
      </Dialog>
    </div>
  );
}

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
  const updateMealName = useNutritionPlanStore((s) => s.updateMealName);
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

  // ── Local UI state ──
  const [selectedDay, setSelectedDay] = useState(1);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const dayHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openMeals, setOpenMeals] = useState<Set<string>>(new Set());
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [newMealTime, setNewMealTime] = useState('');
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // ── Load plan ──
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getPlan(planId);
        if (!cancelled) setPlan(data);
      } catch {
        // Plan load failed
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
    };
  }, [plan?.globalSettings, clientDashboard]);

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
    } catch {
      showApiError(undefined, 'nutrition.versionConflict');
    }
  };

  const handleReset = async () => {
    if (!planId) return;
    try {
      const data = await getPlan(planId);
      setPlan(data);
    } catch {
      showApiError(undefined, 'common.error');
    }
  };

  const handlePublish = async () => {
    if (!window.confirm(t('nutrition.confirmPublishWeek'))) return;
    try {
      await publishWeek(selectedWeek);
      showSuccess(t('nutrition.weekPublished_success', { number: selectedWeek }));
    } catch {
      showApiError(undefined, 'common.error');
    }
  };

  const handleAddMeal = () => {
    if (!plan || !newMealName.trim()) return;
    const week = plan.weeks.find((w) => w.weekNumber === selectedWeek);
    const day = week?.days.find((d) => d.dayOfWeek === selectedDay);
    const order = (day?.meals.length ?? 0) + 1;
    const meal: PlanMeal = {
      mealId: crypto.randomUUID(),
      name: newMealName.trim(),
      order,
      time: newMealTime || null,
      foods: [],
      recipes: [],
      mealTotals: null,
    };
    addMeal(selectedWeek, selectedDay, meal);
    setOpenMeals((prev) => new Set([...prev, meal.mealId]));
    setNewMealName('');
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

  const dayTotals: NutrientTotals = currentDay?.dayTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  // ── Week/Day tabs data ──
  const weekTabs: WeekTabData[] = useMemo(() => {
    if (!plan) return [];
    return plan.weeks.map((w) => {
      return {
        index: w.weekNumber,
        label: t('nutrition.weekLabel', { number: w.weekNumber }),
        isTemplate: w.status === 'Published',
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

  // ── Shopping list aggregation ──
  // Shopping list: aggregate foods + recipe ingredients for the selected week
  type ShoppingItem = { id: string; name: string; amount: number; unit: string };
  const [shoppingData, setShoppingData] = useState<{ firstHalf: ShoppingItem[]; secondHalf: ShoppingItem[] }>({ firstHalf: [], secondHalf: [] });
  const [shoppingLoading, setShoppingLoading] = useState(false);

  useEffect(() => {
    if (!shoppingListOpen || !plan) return;
    let cancelled = false;

    async function buildShoppingList() {
      setShoppingLoading(true);
      const week = plan!.weeks.find(w => w.weekNumber === selectedWeek);
      if (!week) { setShoppingData({ firstHalf: [], secondHalf: [] }); setShoppingLoading(false); return; }

      // Collect all unique recipe IDs used in this week
      const recipeIds = new Set<string>();
      for (const day of week.days) {
        for (const meal of day.meals) {
          for (const recipe of (meal.recipes ?? [])) {
            recipeIds.add(recipe.recipeId);
          }
        }
      }

      // Fetch recipe details to get their ingredients
      const recipeMap = new Map<string, { foodExternalId: string; foodName: string; amountGrams: number }[]>();
      if (recipeIds.size > 0) {
        const { getRecipe } = await import('@/api/recipes');
        const results = await Promise.allSettled(
          Array.from(recipeIds).map(id => getRecipe(id))
        );
        for (const r of results) {
          if (r.status === 'fulfilled') {
            recipeMap.set(r.value.recipeId, r.value.foods);
          }
        }
      }

      if (cancelled) return;

      function aggregateDays(days: NonNullable<typeof week>['days']) {
        const agg = new Map<string, { name: string; amount: number }>();
        for (const day of days) {
          for (const meal of day.meals) {
            // Direct foods
            for (const food of meal.foods) {
              const key = food.foodExternalId;
              const existing = agg.get(key);
              if (existing) existing.amount += food.amountGrams;
              else agg.set(key, { name: resolveLocalizedName(food, i18n.language), amount: food.amountGrams });
            }
            // Recipe ingredients (scaled by servings)
            for (const recipe of (meal.recipes ?? [])) {
              const ingredients = recipeMap.get(recipe.recipeId);
              if (!ingredients) continue;
              for (const ing of ingredients) {
                const key = ing.foodExternalId;
                const scaledAmount = ing.amountGrams * recipe.servings;
                const existing = agg.get(key);
                if (existing) existing.amount += scaledAmount;
                else agg.set(key, { name: ing.foodName, amount: scaledAmount });
              }
            }
          }
        }
        return Array.from(agg.entries()).map(([id, val]) => ({ id, name: val.name, amount: val.amount, unit: 'g' }));
      }

      const firstDays = week.days.filter(d => d.dayOfWeek >= 1 && d.dayOfWeek <= 4);
      const secondDays = week.days.filter(d => d.dayOfWeek >= 5 && d.dayOfWeek <= 7);

      setShoppingData({
        firstHalf: aggregateDays(firstDays),
        secondHalf: aggregateDays(secondDays),
      });
      setShoppingLoading(false);
    }

    buildShoppingList();
    return () => { cancelled = true; };
  }, [shoppingListOpen, plan, selectedWeek, i18n.language]);

  // ── Loading state ──
  if (!plan) {
    return (
      <div className="flex items-center justify-center text-text3" style={{ height: '100vh' }}>
        {t('common.loading')}
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
            <Button variant="default" size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
              {t('nutrition.save')}
            </Button>
            <Button variant="primary" size="sm" onClick={handlePublish} disabled={isWeekPublished || isDirty}>
              {isWeekPublished ? t('nutrition.published') : t('nutrition.publishWeekButton')}
            </Button>
          </div>
        }
      />
      </div>

      {/* ── Week tabs ── */}
      <WeekDayTabs
        weeks={weekTabs}
        days={[]}
        selectedWeek={selectedWeek}
        selectedDay={selectedDay}
        onWeekChange={setSelectedWeek}
        onDayChange={setSelectedDay}
        onAddWeek={addWeek}
        onRemoveWeek={removeWeek}
        onReorderWeeks={reorderWeeks}
      />

      {/* ── Two-column body ── */}
      <div className="flex-1 overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '1fr 256px' }}>
        {/* Left: Day tabs + Meals */}
        <div className="flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--border)', minWidth: 0 }}>
          {/* Day tabs inside meals column */}
          <div className="flex items-center border-b border-border shrink-0">
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
              </button>
            ))}
          </div>
          <div key={`${selectedWeek}-${selectedDay}`} className="tab-content-transition flex-1 overflow-y-auto" style={{ padding: '12px 20px' }}>
            {/* Day note */}
            <DayNoteInput
              note={currentDay?.note}
              onChange={(n) => updateDayNote(selectedWeek, selectedDay, n)}
              addLabel={t('nutrition.addDayNote')}
              placeholder={t('nutrition.dayNotePlaceholder')}
            />

            {meals.length === 0 && (
              <div className="py-12 text-center text-[13px] text-text3">
                {t('nutrition.noMealsMessage')}
              </div>
            )}

            <div
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
                })}
                onRecipeServingsChange={(recipeId, s) => updateRecipeServings(selectedWeek, selectedDay, meal.mealId, recipeId, s)}
                onRecipeRemove={(recipeId) => removeRecipeFromMeal(selectedWeek, selectedDay, meal.mealId, recipeId)}
                onRecipeNoteChange={(recipeId, n) => updateRecipeNote(selectedWeek, selectedDay, meal.mealId, recipeId, n)}
                onNameChange={(newName) => updateMealName(selectedWeek, selectedDay, meal.mealId, newName)}
                onNoteChange={(n) => updateMealNote(selectedWeek, selectedDay, meal.mealId, n)}
                onFoodNoteChange={(foodId, n) => updateFoodNote(selectedWeek, selectedDay, meal.mealId, foodId, n)}
                onItemDrop={(data) => {
                  const sourceDay = data.dayOfWeek ?? selectedDay;
                  const sourceWeek = (data as any).weekNumber ?? selectedWeek;
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
                    name: `${meal.name} (kopie)`,
                    order: meals.length + 1,
                  };
                  addMeal(selectedWeek, selectedDay, clone);
                }}
                onRemove={() => removeMeal(selectedWeek, selectedDay, meal.mealId)}
                lang={i18n.language}
                removeMealTitle={t('nutrition.removeMealTitle')}
                removeMealMessage={t('nutrition.removeMealMessage', { name: meal.name })}
                cancelLabel={t('common.cancel')}
                removeLabel={t('nutrition.remove')}
              />
            ))}
            </div>

            {/* Add meal button */}
            <div
              className="flex items-center gap-1.5 px-3 py-2 mt-2 border border-dashed border-border rounded-md cursor-pointer text-text3 text-[13px] transition-colors hover:bg-bg-hover hover:text-text"
              onClick={() => { setNewMealName(''); setNewMealTime(''); setAddMealOpen(true); }}
            >
              <span>+</span>
              <span>{t('nutrition.addMealButton')}</span>
            </div>
          </div>
        </div>

        {/* Right: Macro sidebar */}
        <div className="flex flex-col overflow-y-auto bg-bg2">
          {/* Start date picker */}
          <div className="p-3 border-b border-border">
            <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-1.5">
              {t('nutrition.planStartDate')}
            </div>
            <MondayDatePicker
              value={plan.startDate?.split('T')[0] ?? null}
              onChange={(val) => setStartDate(val)}
              className="auth-input"
              style={{ fontSize: 13, padding: '7px 10px', width: '100%' }}
            />
          </div>

          <MacroSidebar totals={dayTotals} targets={targets} />

          {/* Client info section */}
          <div className="p-3 border-t border-border">
            <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-2">
              {t('nutrition.planClient')}
            </div>
            <div className="text-xs flex flex-col gap-1 mb-2.5">
              <div className="flex justify-between">
                <span className="text-text3">{t('nutrition.planName')}</span>
                <span className="text-text">{plan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text3">{t('nutrition.planStatus')}</span>
                <span className={cn(
                  'text-[11px] rounded-full px-[6px] py-[1px] font-medium',
                  currentWeek?.status === 'Published'
                    ? 'bg-green-bg text-green'
                    : 'bg-bg3 text-text3',
                )}>
                  {currentWeek?.status === 'Published' ? t('nutrition.weekPublished') : t('nutrition.concept')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text3">{t('nutrition.planGoalKcal')}</span>
                <span className="text-text">{targets.kcal.toLocaleString('cs-CZ')} kcal</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setCheckedItems(new Set()); setShoppingListOpen(true); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', padding: '7px 0',
                border: '1px solid var(--border-md)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg)', color: 'var(--text2)', fontSize: 12, fontWeight: 500,
                fontFamily: 'inherit', cursor: 'pointer', transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--text2)'; }}
            >
              🛒 {t('nutrition.shoppingList')}
            </button>
          </div>
        </div>
      </div>

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
      <Dialog
        open={addMealOpen}
        onClose={() => setAddMealOpen(false)}
        title={t('nutrition.addMealButton')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddMealOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleAddMeal} disabled={!newMealName.trim()}>{t('nutrition.addMealButton')}</Button>
          </>
        }
      >
        <Input
          label={t('nutrition.mealName')}
          placeholder={t('nutrition.mealNamePlaceholder')}
          value={newMealName}
          onChange={(e) => setNewMealName(e.target.value)}
          autoFocus
        />
        <div className="form-group">
          <label className="form-label">{t('nutrition.mealTime')}</label>
          <input
            type="time"
            className="auth-input"
            style={{ fontSize: 13, padding: '7px 10px', cursor: 'pointer', width: '100%' }}
            value={newMealTime}
            onChange={(e) => setNewMealTime(e.target.value)}
          />
        </div>
      </Dialog>

      {/* ── Shopping List Drawer ── */}
      {shoppingListOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}
          onClick={() => setShoppingListOpen(false)}
        >
          {/* Backdrop */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
          {/* Drawer */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative', width: 420, maxWidth: '90vw', height: '100vh',
              background: 'var(--bg)', borderLeft: '1px solid var(--border)',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column',
              animation: 'authStepIn 0.2s ease-out',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>🛒 {t('nutrition.shoppingListWeek', { week: selectedWeek })}</div>
              <button
                type="button"
                onClick={() => setShoppingListOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text3)', padding: 4, borderRadius: 'var(--radius)' }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {shoppingLoading && (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text3)' }}>{t('nutrition.loadingIngredients')}</div>
              )}
              {!shoppingLoading && <>
              {/* First half: Mon-Thu */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                  {t('nutrition.monToThu')}
                </div>
                {shoppingData.firstHalf.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text4)', padding: '8px 0' }}>{t('nutrition.noItems')}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {shoppingData.firstHalf.map((item) => (
                      <label
                        key={item.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                      >
                        <input
                          type="checkbox"
                          checked={checkedItems.has(item.id)}
                          onChange={() => setCheckedItems(prev => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })}
                          style={{ accentColor: 'var(--green)' }}
                        />
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', textDecoration: checkedItems.has(item.id) ? 'line-through' : undefined, opacity: checkedItems.has(item.id) ? 0.5 : 1 }}>
                          {item.name}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {Math.round(item.amount)} {item.unit}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 16px' }} />

              {/* Second half: Fri-Sun */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                  {t('nutrition.friToSun')}
                </div>
                {shoppingData.secondHalf.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text4)', padding: '8px 0' }}>{t('nutrition.noItems')}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {shoppingData.secondHalf.map((item) => (
                      <label
                        key={item.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                      >
                        <input
                          type="checkbox"
                          checked={checkedItems.has(item.id + '-2')}
                          onChange={() => setCheckedItems(prev => { const k = item.id + '-2'; const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                          style={{ accentColor: 'var(--green)' }}
                        />
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', textDecoration: checkedItems.has(item.id + '-2') ? 'line-through' : undefined, opacity: checkedItems.has(item.id + '-2') ? 0.5 : 1 }}>
                          {item.name}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {Math.round(item.amount)} {item.unit}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              </>}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const format = (items: typeof shoppingData.firstHalf, suffix: string) =>
                    items.map(item => {
                      const key = suffix ? item.id + suffix : item.id;
                      return `${checkedItems.has(key) ? '☑' : '☐'} ${item.name} – ${Math.round(item.amount)} ${item.unit}`;
                    }).join('\n');
                  const text = `${t('nutrition.monToThu').toUpperCase()}\n${format(shoppingData.firstHalf, '')}\n\n${t('nutrition.friToSun').toUpperCase()}\n${format(shoppingData.secondHalf, '-2')}`;
                  navigator.clipboard.writeText(text);
                  showSuccess(t('nutrition.shoppingList'));
                }}
              >
                📋 {t('nutrition.copy')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

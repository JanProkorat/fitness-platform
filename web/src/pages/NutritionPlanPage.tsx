import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useNutritionPlanStore } from '@/stores/nutritionPlan';
import { getPlan } from '@/api/plans';
import { getClientDashboard } from '@/api/nutrition-goals';
import { Button, Dialog, Input } from '@/components/ui';
import { MacroSidebar, MealBlock, WeekDayTabs } from '@/components/nutrition';
import type { MealBlockFood } from '@/components/nutrition';
import type { WeekTabData, DayTabData } from '@/components/nutrition/WeekDayTabs';
import type { PlanMeal, MealFood, NutrientTotals } from '@/api/plan-types';
import { showSuccess, showApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';

const DAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'] as const;

/** Day-level note input */
function DayNoteInput({ note, onChange }: { note?: string | null; onChange: (note: string) => void }) {
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
        + Přidat poznámku ke dni
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
        placeholder="Poznámka ke dni..."
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

/** Sortable wrapper for a meal in the day list */
function SortableMealItem({
  meal,
  index,
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
  onRemove,
}: {
  meal: PlanMeal;
  index: number;
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
  onItemDrop: (data: { type: string; foodId?: string; recipeId?: string; mealId: string }) => void;
  onReorder: (itemIds: string[]) => void;
  onTimeChange: (time: string) => void;
  onRemove: () => void;
}) {

  const mealFoods: MealBlockFood[] = meal.foods.map((f) => {
    const scale = f.amountGrams / 100;
    return {
      id: f.foodExternalId,
      name: f.foodName,
      amount: f.amountGrams,
      unit: 'g',
      kcal: f.nutrientValuePer100Grams.kcal * scale,
      protein: f.nutrientValuePer100Grams.protein * scale,
      carbs: f.nutrientValuePer100Grams.carbs * scale,
      fat: f.nutrientValuePer100Grams.fat * scale,
      note: f.note,
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
        e.dataTransfer.setData('application/meal-json', JSON.stringify({ type: 'meal', mealId: meal.mealId }));
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
        onRemove={() => setConfirmRemove(true)}
      />
      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Odebrat jídlo?"
        maxWidth={380}
        footer={
          <>
            <Button onClick={() => setConfirmRemove(false)}>Zrušit</Button>
            <Button variant="danger" onClick={() => { setConfirmRemove(false); onRemove(); }}>
              Odebrat
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          Jídlo <strong>{meal.name}</strong> a všechny jeho položky budou odebrány z tohoto dne.
        </p>
      </Dialog>
    </div>
  );
}

export default function NutritionPlanPage() {
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
  const reorderFoodsInMeal = useNutritionPlanStore((s) => s.reorderFoodsInMeal);
  const updateMealTime = useNutritionPlanStore((s) => s.updateMealTime);

  // ── Local UI state ──
  const [selectedDay, setSelectedDay] = useState(1);
  const [openMeals, setOpenMeals] = useState<Set<string>>(new Set());
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [newMealTime, setNewMealTime] = useState('');
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const [shoppingWeekFrom, setShoppingWeekFrom] = useState(1);
  const [shoppingWeekTo, setShoppingWeekTo] = useState(1);
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
      showSuccess('Plán uložen');
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
    if (!window.confirm(`Opravdu chcete publikovat týden ${selectedWeek}?`)) return;
    try {
      await publishWeek(selectedWeek);
      showSuccess(`Týden ${selectedWeek} publikován`);
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
    (mealId: string, food: { name: string; kcal: number; protein: number; carbs: number; fat: number }) => {
      if (!plan) return;
      const mealFood: MealFood = {
        foodExternalId: crypto.randomUUID(),
        foodName: food.name,
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
      const avgKcal = w.days.reduce((sum, d) => sum + (d.dayTotals?.kcal ?? 0), 0) / Math.max(w.days.length, 1);
      return {
        index: w.weekNumber,
        label: `Týden ${w.weekNumber}`,
        isTemplate: w.status === 'Published',
      };
    });
  }, [plan]);

  const dayTabs: DayTabData[] = useMemo(() => {
    if (!currentWeek) return [];
    return DAY_LABELS.map((label, idx) => {
      const dayOfWeek = idx + 1;
      const day = currentWeek.days.find((d) => d.dayOfWeek === dayOfWeek);
      const kcal = day?.dayTotals?.kcal ?? 0;
      return {
        index: dayOfWeek,
        label,
        badge: kcal > 0 ? `${Math.round(kcal)} kcal` : '—',
      };
    });
  }, [currentWeek]);

  // ── Shopping list aggregation ──
  const shoppingItems = useMemo(() => {
    if (!plan) return [];
    const agg = new Map<string, { name: string; grams: number }>();
    for (const week of plan.weeks) {
      if (week.weekNumber < shoppingWeekFrom || week.weekNumber > shoppingWeekTo) continue;
      for (const day of week.days) {
        for (const meal of day.meals) {
          for (const food of meal.foods) {
            const existing = agg.get(food.foodExternalId);
            if (existing) {
              existing.grams += food.amountGrams;
            } else {
              agg.set(food.foodExternalId, { name: food.foodName, grams: food.amountGrams });
            }
          }
        }
      }
    }
    return Array.from(agg.entries()).map(([id, val]) => ({ id, ...val }));
  }, [plan, shoppingWeekFrom, shoppingWeekTo]);

  // ── Loading state ──
  if (!plan) {
    return (
      <div className="flex items-center justify-center text-text3" style={{ height: '100vh' }}>
        Načítání...
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100vh' }}>
      {/* ── Topbar ── */}
      <div className="flex items-center gap-2 px-4 shrink-0 border-b border-border bg-bg" style={{ height: 44 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {clientDashboard ? `${clientDashboard.firstName} ${clientDashboard.lastName}` : '...'} — Jídelníček
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {isDirty && (
            <span style={{ fontSize: 11, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--orange)' }} />
              Neuložené změny
            </span>
          )}
          {isSaving && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Ukládání...</span>
          )}
          <Button variant="default" size="sm" onClick={() => setResetConfirmOpen(true)} disabled={!isDirty}>
            Zahodit změny
          </Button>
          <Button variant="default" size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
            Uložit
          </Button>
          <Button variant="primary" size="sm" onClick={handlePublish} disabled={isWeekPublished || isDirty}>
            {isWeekPublished ? 'Publikováno ✓' : 'Publikovat'}
          </Button>
        </div>
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
                style={{ flex: 1, border: 'none', background: 'none', fontFamily: 'inherit', borderBottom: day.index === selectedDay ? '2px solid var(--text)' : '2px solid transparent', marginBottom: -1, padding: '7px 0', fontSize: 12, color: day.index === selectedDay ? 'var(--text)' : 'var(--text3)', fontWeight: day.index === selectedDay ? 500 : 400, cursor: 'pointer', textAlign: 'center' as const, whiteSpace: 'nowrap' as const, transition: 'color 0.1s' }}
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
          <div className="flex-1 overflow-y-auto" style={{ padding: '12px 20px' }}>
            {/* Day note */}
            <DayNoteInput
              note={currentDay?.note}
              onChange={(n) => updateDayNote(selectedWeek, selectedDay, n)}
            />

            {meals.length === 0 && (
              <div className="py-12 text-center text-[13px] text-text3">
                Žádná jídla. Přidejte první jídlo kliknutím níže.
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
                  // Find target meal from mouse position
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
                  const oldIndex = meals.findIndex((m) => m.mealId === data.mealId);
                  if (oldIndex === -1 || oldIndex === targetIndex) return;
                  const newOrder = [...meals];
                  const [moved] = newOrder.splice(oldIndex, 1);
                  newOrder.splice(targetIndex > oldIndex ? targetIndex - 1 : targetIndex, 0, moved);
                  reorderMeals(selectedWeek, selectedDay, newOrder.map((m) => m.mealId));
                } catch { /* ignore */ }
              }}
            >
            {meals.map((meal, index) => (
              <SortableMealItem
                key={meal.mealId}
                meal={meal}
                index={index}
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
                  if (data.type === 'food' && data.foodId) {
                    moveFoodToMeal(selectedWeek, selectedDay, data.mealId, meal.mealId, data.foodId);
                  } else if (data.type === 'recipe' && data.recipeId) {
                    moveRecipeToMeal(selectedWeek, selectedDay, data.mealId, meal.mealId, data.recipeId);
                  }
                }}
                onReorder={(itemIds) => reorderFoodsInMeal(selectedWeek, selectedDay, meal.mealId, itemIds)}
                onTimeChange={(t) => updateMealTime(selectedWeek, selectedDay, meal.mealId, t)}
                onRemove={() => removeMeal(selectedWeek, selectedDay, meal.mealId)}
              />
            ))}
            </div>

            {/* Add meal button */}
            <div
              className="flex items-center gap-1.5 px-3 py-2 mt-2 border border-dashed border-border rounded-md cursor-pointer text-text3 text-[13px] transition-colors hover:bg-bg-hover hover:text-text"
              onClick={() => { setNewMealName(''); setNewMealTime(''); setAddMealOpen(true); }}
            >
              <span>+</span>
              <span>Přidat jídlo</span>
            </div>
          </div>
        </div>

        {/* Right: Macro sidebar */}
        <div className="flex flex-col overflow-y-auto bg-bg2">
          {/* Start date picker */}
          <div className="p-3 border-b border-border">
            <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-1.5">
              Začátek plánu
            </div>
            <input
              type="date"
              value={plan.startDate?.split('T')[0] ?? ''}
              onChange={(e) => setStartDate(e.target.value || null)}
              className="auth-input"
              style={{ fontSize: 13, padding: '7px 10px', cursor: 'pointer', width: '100%' }}
            />
          </div>

          <MacroSidebar totals={dayTotals} targets={targets} />

          {/* Client info section */}
          <div className="p-3 border-t border-border">
            <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-2">
              Klient
            </div>
            <div className="text-xs flex flex-col gap-1 mb-2.5">
              <div className="flex justify-between">
                <span className="text-text3">Plán</span>
                <span className="text-text">{plan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text3">Status</span>
                <span className={cn(
                  'text-[11px] rounded-full px-[6px] py-[1px] font-medium',
                  currentWeek?.status === 'Published'
                    ? 'bg-green-bg text-green'
                    : 'bg-bg3 text-text3',
                )}>
                  {currentWeek?.status === 'Published' ? 'Publikováno' : 'Koncept'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text3">Cíl kcal</span>
                <span className="text-text">{targets.kcal.toLocaleString('cs-CZ')} kcal</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setShoppingWeekFrom(selectedWeek); setShoppingWeekTo(selectedWeek); setCheckedItems(new Set()); setShoppingListOpen(true); }}
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
              🛒 Nákupní seznam
            </button>
          </div>
        </div>
      </div>

      {/* ── Reset Confirmation Dialog ── */}
      <Dialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="Zahodit změny?"
        maxWidth={380}
        footer={
          <>
            <Button onClick={() => setResetConfirmOpen(false)}>Zrušit</Button>
            <Button variant="danger" onClick={() => { setResetConfirmOpen(false); handleReset(); }}>
              Zahodit změny
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          Všechny neuložené změny budou ztraceny a plán se vrátí do posledního uloženého stavu.
        </p>
      </Dialog>

      {/* ── Add Meal Dialog ── */}
      <Dialog
        open={addMealOpen}
        onClose={() => setAddMealOpen(false)}
        title="Přidat jídlo"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddMealOpen(false)}>Zrušit</Button>
            <Button variant="primary" onClick={handleAddMeal} disabled={!newMealName.trim()}>Přidat</Button>
          </>
        }
      >
        <Input
          label="Název jídla"
          placeholder="např. Snídaně, Oběd, Svačina..."
          value={newMealName}
          onChange={(e) => setNewMealName(e.target.value)}
          autoFocus
        />
        <div className="form-group">
          <label className="form-label">Čas (volitelné)</label>
          <input
            type="time"
            className="auth-input"
            style={{ fontSize: 13, padding: '7px 10px', cursor: 'pointer', width: '100%' }}
            value={newMealTime}
            onChange={(e) => setNewMealTime(e.target.value)}
          />
        </div>
      </Dialog>

      {/* ── Shopping List Dialog ── */}
      <Dialog
        open={shoppingListOpen}
        onClose={() => setShoppingListOpen(false)}
        title="🛒 Nákupní seznam"
        maxWidth={560}
        footer={
          <Button variant="ghost" onClick={() => setShoppingListOpen(false)}>Zavřít</Button>
        }
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-text3">Týden od:</span>
          <select
            className="py-[5px] px-2 border border-border-md rounded-md text-[13px] bg-bg text-text"
            value={shoppingWeekFrom}
            onChange={(e) => setShoppingWeekFrom(Number(e.target.value))}
          >
            {plan.weeks.map((w) => (
              <option key={w.weekNumber} value={w.weekNumber}>
                {w.weekNumber}
              </option>
            ))}
          </select>
          <span className="text-xs text-text3">do:</span>
          <select
            className="py-[5px] px-2 border border-border-md rounded-md text-[13px] bg-bg text-text"
            value={shoppingWeekTo}
            onChange={(e) => setShoppingWeekTo(Number(e.target.value))}
          >
            {plan.weeks.map((w) => (
              <option key={w.weekNumber} value={w.weekNumber}>
                {w.weekNumber}
              </option>
            ))}
          </select>
        </div>

        {shoppingItems.length === 0 ? (
          <div className="text-[13px] text-text3 py-4 text-center">
            Žádné potraviny v tomto rozsahu týdnů.
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {shoppingItems.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2 px-2 py-[5px] rounded-md cursor-pointer transition-colors hover:bg-bg-hover"
              >
                <input
                  type="checkbox"
                  checked={checkedItems.has(item.id)}
                  onChange={() => {
                    setCheckedItems((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    });
                  }}
                  className="accent-green"
                />
                <span className={cn('text-[13px] flex-1', checkedItems.has(item.id) && 'line-through text-text3')}>
                  {item.name}
                </span>
                <span className="text-xs text-text3 tabular-nums">
                  {Math.round(item.grams)} g
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border flex justify-end">
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              const text = shoppingItems
                .map((item) => `${checkedItems.has(item.id) ? '☑' : '☐'} ${item.name} – ${Math.round(item.grams)} g`)
                .join('\n');
              navigator.clipboard.writeText(text);
              showSuccess('Nákupní seznam zkopírován');
            }}
          >
            📋 Kopírovat
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

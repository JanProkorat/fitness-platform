import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DragDropProvider } from '@dnd-kit/react';
import { useNutritionPlanStore } from '@/stores/nutritionPlan';
import { getPlan, updatePlan, publishPlan as publishPlanApi } from '@/api/plans';
import PlanToolbar from '@/components/nutrition/PlanToolbar';
import DayColumn from '@/components/nutrition/DayColumn';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export default function NutritionPlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const { t } = useTranslation();

  const plan = useNutritionPlanStore((s) => s.plan);
  const isDirty = useNutritionPlanStore((s) => s.isDirty);
  const isSaving = useNutritionPlanStore((s) => s.isSaving);
  const selectedWeek = useNutritionPlanStore((s) => s.selectedWeek);
  const setPlan = useNutritionPlanStore((s) => s.setPlan);
  const setSelectedWeek = useNutritionPlanStore((s) => s.setSelectedWeek);
  const markSaved = useNutritionPlanStore((s) => s.markSaved);
  const setSaving = useNutritionPlanStore((s) => s.setSaving);
  const reorderMeals = useNutritionPlanStore((s) => s.reorderMeals);
  const moveMealToDay = useNutritionPlanStore((s) => s.moveMealToDay);
  const persistDays = useNutritionPlanStore((s) => s.persistDays);
  const swapDays = useNutritionPlanStore((s) => s.swapDays);

  // Load plan on mount
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await getPlan(planId);
        if (!cancelled) setPlan(data);
      } catch {
        // Plan load failed — could redirect
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planId, setPlan]);

  // Auto-save with 2s debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planRef = useRef(plan);
  planRef.current = plan;

  const doSave = useCallback(async () => {
    const currentPlan = planRef.current;
    if (!currentPlan) return;

    setSaving(true);
    try {
      const result = await updatePlan(currentPlan.planId, {
        name: currentPlan.name,
        globalSettings: currentPlan.globalSettings,
        version: currentPlan.version,
      });
      markSaved(result.version);
    } catch {
      setSaving(false);
    }
  }, [setSaving, markSaved]);

  useEffect(() => {
    if (!isDirty) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      doSave();
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [isDirty, plan, doSave]);

  // Publish handler
  const handlePublish = async () => {
    if (!plan) return;
    if (!window.confirm(t('nutrition.confirmPublish'))) return;

    try {
      const result = await publishPlanApi(plan.planId);
      setPlan(result);
    } catch {
      // publish failed
    }
  };

  // Native HTML5 drag state for day swapping
  const [draggedDay, setDraggedDay] = useState<number | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  const handleDayDragStart = useCallback((dayOfWeek: number) => {
    setDraggedDay(dayOfWeek);
  }, []);

  const handleDayDragOver = useCallback((dayOfWeek: number) => {
    setDragOverDay(dayOfWeek);
  }, []);

  const handleDayDrop = useCallback(
    (dayOfWeek: number) => {
      if (draggedDay != null && draggedDay !== dayOfWeek) {
        swapDays(selectedWeek, draggedDay, dayOfWeek);
      }
      setDraggedDay(null);
      setDragOverDay(null);
    },
    [draggedDay, selectedWeek, swapDays],
  );

  // Track which days were affected during a drag for persistence
  const affectedDaysRef = useRef<Set<number>>(new Set());
  // Track the original group of the dragged meal
  const dragSourceGroupRef = useRef<string | null>(null);

  // Parse group string like "meals-1-3" into { weekNum, dayOfWeek }
  const parseGroup = (group: string) => {
    const parts = group.split('-');
    return { weekNum: Number(parts[1]), dayOfWeek: Number(parts[2]) };
  };

  // onDragOver: live reorder/move during drag (local state only)
  const handleDragOver = useCallback(
    (event: { operation: { source?: { type?: string; id?: string; group?: string }; target?: { type?: string; id?: string; group?: string } } }) => {
      const { source, target } = event.operation;
      if (!source || !target || !plan) return;
      if (source.type !== 'meal' || target.type !== 'meal') return;

      // Remember the original source group on first dragOver
      if (!dragSourceGroupRef.current) {
        dragSourceGroupRef.current = String(source.group ?? '');
      }

      const sourceGroup = String(source.group ?? '');
      const targetGroup = String(target.group ?? '');
      const src = parseGroup(sourceGroup);
      const tgt = parseGroup(targetGroup);
      if (!src.weekNum || !src.dayOfWeek || !tgt.weekNum || !tgt.dayOfWeek) return;

      if (sourceGroup === targetGroup) {
        // Reorder within same day
        const week = plan.weeks.find((w) => w.weekNumber === src.weekNum);
        const day = week?.days.find((d) => d.dayOfWeek === src.dayOfWeek);
        if (!day) return;

        const sortedMeals = day.meals.slice().sort((a, b) => a.order - b.order);
        const mealIds = sortedMeals.map((m) => m.mealId);

        const fromIdx = mealIds.indexOf(String(source.id));
        const toIdx = mealIds.indexOf(String(target.id));
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

        const reordered = [...mealIds];
        reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, String(source.id));

        affectedDaysRef.current.add(src.dayOfWeek);
        reorderMeals(src.weekNum, src.dayOfWeek, reordered);
      } else {
        // Move meal to a different day
        const targetDayData = plan.weeks
          .find((w) => w.weekNumber === tgt.weekNum)
          ?.days.find((d) => d.dayOfWeek === tgt.dayOfWeek);
        const targetMeals = targetDayData?.meals.slice().sort((a, b) => a.order - b.order) ?? [];
        const targetIdx = target.id
          ? targetMeals.findIndex((m) => m.mealId === String(target.id))
          : targetMeals.length;

        affectedDaysRef.current.add(src.dayOfWeek);
        affectedDaysRef.current.add(tgt.dayOfWeek);
        moveMealToDay(
          src.weekNum,
          src.dayOfWeek,
          tgt.dayOfWeek,
          String(source.id),
          targetIdx === -1 ? targetMeals.length : targetIdx,
        );
      }
    },
    [plan, reorderMeals, moveMealToDay],
  );

  // onDragEnd: persist all affected days to the API
  const handleDragEnd = useCallback(() => {
    const days = affectedDaysRef.current;
    if (days.size > 0) {
      persistDays(selectedWeek, Array.from(days));
    }
    affectedDaysRef.current = new Set();
    dragSourceGroupRef.current = null;
  }, [selectedWeek, persistDays]);

  if (!plan) {
    return (
      <div className="flex h-full items-center justify-center text-text3">
        {t('common.loading')}
      </div>
    );
  }

  const currentWeek = plan.weeks.find((w) => w.weekNumber === selectedWeek) ?? plan.weeks[0];
  const days = currentWeek?.days ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Back link */}
      <div className="border-b border-border bg-[#111111] px-6 py-2">
        <Link
          to="/plans"
          className="font-heading text-xs font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
        >
          &larr; {t('nutrition.backToPlans')}
        </Link>
      </div>

      {/* Toolbar */}
      <PlanToolbar
        planName={plan.name}
        status={plan.status}
        isDirty={isDirty}
        isSaving={isSaving}
        selectedWeek={selectedWeek}
        totalWeeks={plan.weeks.length}
        onPublish={handlePublish}
        onWeekChange={setSelectedWeek}
      />

      {/* Day columns with drag and drop */}
      <DragDropProvider onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {DAY_KEYS.map((key, idx) => {
            const dayOfWeek = idx + 1;
            const day = days.find((d) => d.dayOfWeek === dayOfWeek) ?? {
              dayOfWeek,
              meals: [],
              dayTotals: null,
            };

            return (
              <DayColumn
                key={dayOfWeek}
                day={day}
                weekNumber={selectedWeek}
                dayLabel={t(`nutrition.${key}`)}
                globalSettings={plan.globalSettings}
                onDayDragStart={handleDayDragStart}
                onDayDragOver={handleDayDragOver}
                onDayDrop={handleDayDrop}
                isDragOver={dragOverDay === dayOfWeek}
              />
            );
          })}
        </div>
      </DragDropProvider>
    </div>
  );
}

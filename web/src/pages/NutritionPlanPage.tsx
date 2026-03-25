import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { DragDropProvider, DragOverlay, useDroppable, useDragOperation } from '@dnd-kit/react';
import type { DragEndEvent, DragStartEvent, DragMoveEvent } from '@dnd-kit/dom';
import { useNutritionPlanStore } from '@/stores/nutritionPlan';
import { getPlan } from '@/api/plans';
import { getClientDashboard } from '@/api/nutrition-goals';
import PlanToolbar from '@/components/nutrition/PlanToolbar';
import DayColumn from '@/components/nutrition/DayColumn';
import WeekSelector from '@/components/nutrition/WeekSelector';
import NutritionGoalsTab from '@/components/nutrition/NutritionGoalsTab';
import NutritionWeekTab from '@/components/nutrition/NutritionWeekTab';

import { showSuccess, showApiError } from '@/lib/api-errors';
import type { DragData } from '@/components/training/dnd-types';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/// Droppable day column wrapper for nutrition plan (accepts 'day' and 'meal' types).
function NutritionDroppableDay({ dayOfWeek, children }: { dayOfWeek: number; children: React.ReactNode }) {
  const { ref, isDropTarget } = useDroppable({
    id: `nutrition-day-drop-${dayOfWeek}`,
    data: { type: 'day-column', dayOfWeek },
    accept: ['day', 'meal'],
  });
  return (
    <div
      ref={ref}
      data-nutrition-day={dayOfWeek}
      className={`flex flex-col flex-1 transition-colors duration-200 ease-out ${isDropTarget ? 'ring-1 ring-gold' : ''}`}
    >
      {children}
    </div>
  );
}

/// Floating overlay for day drag.
function NutritionDayOverlay() {
  const { t } = useTranslation();
  const { source } = useDragOperation();
  if (!source) return null;
  const data = source.data as DragData | undefined;
  if (!data || data.type !== 'day') return null;
  return (
    <DragOverlay dropAnimation={null}>
      <div className="rounded-sm border border-gold/40 bg-surface px-3 py-2 shadow-lg shadow-black/40">
        <span className="font-heading text-xs font-bold uppercase tracking-wide text-gold">
          {t(`nutrition.${DAY_KEYS[data.dayOfWeek - 1]}`)}
        </span>
      </div>
    </DragOverlay>
  );
}

export default function NutritionPlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const { t } = useTranslation();

  const plan = useNutritionPlanStore((s) => s.plan);
  const isDirty = useNutritionPlanStore((s) => s.isDirty);
  const isSaving = useNutritionPlanStore((s) => s.isSaving);
  const selectedWeek = useNutritionPlanStore((s) => s.selectedWeek);
  const setPlan = useNutritionPlanStore((s) => s.setPlan);
  const setSelectedWeek = useNutritionPlanStore((s) => s.setSelectedWeek);
  const save = useNutritionPlanStore((s) => s.save);
  const publishWeek = useNutritionPlanStore((s) => s.publishWeek);
  const addWeek = useNutritionPlanStore((s) => s.addWeek);
  const removeWeek = useNutritionPlanStore((s) => s.removeWeek);
  const reorderMeals = useNutritionPlanStore((s) => s.reorderMeals);
  const moveMealToDay = useNutritionPlanStore((s) => s.moveMealToDay);
  const reorderDay = useNutritionPlanStore((s) => s.reorderDay);
  const setStartDate = useNutritionPlanStore((s) => s.setStartDate);

  const [activeTab, setActiveTab] = useState<'mealPlan' | 'nutritionGoals'>('mealPlan');

  const isStartDateLocked = Boolean(
    plan?.startDate && new Date(plan.startDate + 'T00:00:00') < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
  );

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

  // Fetch client dashboard for meal distribution targets
  const { data: clientDashboard } = useQuery({
    queryKey: ['client-dashboard', plan?.clientId],
    queryFn: () => getClientDashboard(plan!.clientId),
    enabled: !!plan?.clientId,
  });

  const mealDistribution = useMemo(() => {
    const ob = clientDashboard?.onboarding;
    if (!ob?.mealDistribution) return null;
    try {
      return JSON.parse(ob.mealDistribution) as Record<string, number>;
    } catch {
      return null;
    }
  }, [clientDashboard]);

  const dailyKcal = clientDashboard?.onboarding?.adjustedKcal ?? null;

  // Warn the user if they try to leave with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Save handler
  const handleSave = async () => {
    try {
      await save();
      showSuccess(t('nutrition.planSaved'));
    } catch {
      showApiError(undefined, 'nutrition.versionConflict');
    }
  };

  // Publish week handler
  const handlePublishWeek = async () => {
    if (!window.confirm(t('nutrition.confirmPublishWeek', { number: selectedWeek }))) return;
    try {
      await publishWeek(selectedWeek);
      showSuccess(t('nutrition.weekPublished_success', { number: selectedWeek }));
    } catch {
      showApiError(undefined, 'common.error');
    }
  };

  const copyDayToDay = useNutritionPlanStore((s) => s.copyDayToDay);
  const copyDayToWeek = useNutritionPlanStore((s) => s.copyDayToWeek);

  // Day drag state (pointer-based via dnd-kit, survives week switch)
  const activeDayDragRef = useRef<DragData | null>(null);
  const [dayGapIndicator, setDayGapIndicator] = useState<number | null>(null);
  const dayGapRef = useRef<number | null>(null);
  const [copyDialog, setCopyDialog] = useState<{ fromWeek: number; from: number; toWeek: number; to: number } | null>(null);

  const handleCopyConfirm = () => {
    if (!copyDialog) return;
    if (copyDialog.fromWeek === copyDialog.toWeek) {
      copyDayToDay(copyDialog.fromWeek, copyDialog.from, copyDialog.to);
    } else {
      copyDayToWeek(copyDialog.fromWeek, copyDialog.from, copyDialog.toWeek, copyDialog.to);
    }
    setCopyDialog(null);
  };

  // WeekTab renderTab for WeekSelector
  const renderWeekTab = useCallback(
    (props: { weekNumber: number; status: 'Draft' | 'Published'; isSelected: boolean }) => (
      <NutritionWeekTab {...props} />
    ),
    [],
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

  // Stash day drag data on start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const source = event.operation.source;
    if (source?.type === 'day') {
      activeDayDragRef.current = source.data as DragData;
    }
  }, []);

  // onDragMove: update gap indicator for day drags
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const dragData = activeDayDragRef.current;
    if (!dragData || dragData.type !== 'day') {
      if (dayGapRef.current !== null) { dayGapRef.current = null; setDayGapIndicator(null); }
      return;
    }
    const pointerX = event.operation.position.current.x;
    const draggedDay = dragData.dayOfWeek;
    const dayCols = Array.from(document.querySelectorAll<HTMLElement>('[data-nutrition-day]'))
      .sort((a, b) => Number(a.dataset.nutritionDay) - Number(b.dataset.nutritionDay));
    if (dayCols.length === 0) { dayGapRef.current = null; setDayGapIndicator(null); return; }

    const GAP_ZONE = 20;
    let gapPosition: number | null = null;

    for (let i = 0; i < dayCols.length; i++) {
      const rect = dayCols[i].getBoundingClientRect();
      const dayNum = Number(dayCols[i].dataset.nutritionDay);

      if (pointerX < rect.left + GAP_ZONE && pointerX >= rect.left - GAP_ZONE) {
        if (dayNum !== draggedDay && dayNum !== draggedDay + 1) gapPosition = dayNum;
        break;
      }
      if (i === dayCols.length - 1 && pointerX > rect.right - GAP_ZONE && pointerX <= rect.right + GAP_ZONE) {
        if (dayNum !== draggedDay && dayNum + 1 !== draggedDay) gapPosition = dayNum + 1;
        break;
      }
      if (i < dayCols.length - 1) {
        const nextRect = dayCols[i + 1].getBoundingClientRect();
        if (pointerX >= rect.right - GAP_ZONE && pointerX <= nextRect.left + GAP_ZONE) {
          const pos = dayNum + 1;
          if (pos !== draggedDay && pos !== draggedDay + 1) gapPosition = pos;
          break;
        }
      }
    }

    if (dayGapRef.current !== gapPosition) {
      dayGapRef.current = gapPosition;
      setDayGapIndicator(gapPosition);
    }
  }, []);

  // onDragOver: live reorder/move for MEALS during drag
  const handleMealDragOver = useCallback(
    (event: { operation: { source?: { type?: string; id?: string; group?: string }; target?: { type?: string; id?: string; group?: string } } }) => {
      const { source, target } = event.operation;
      if (!source || !target || !plan) return;
      if (source.type !== 'meal' || target.type !== 'meal') return;

      if (!dragSourceGroupRef.current) {
        dragSourceGroupRef.current = String(source.group ?? '');
      }

      const sourceGroup = String(source.group ?? '');
      const targetGroup = String(target.group ?? '');
      const src = parseGroup(sourceGroup);
      const tgt = parseGroup(targetGroup);
      if (!src.weekNum || !src.dayOfWeek || !tgt.weekNum || !tgt.dayOfWeek) return;

      if (sourceGroup === targetGroup) {
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
        const targetDayData = plan.weeks
          .find((w) => w.weekNumber === tgt.weekNum)
          ?.days.find((d) => d.dayOfWeek === tgt.dayOfWeek);
        const targetMeals = targetDayData?.meals.slice().sort((a, b) => a.order - b.order) ?? [];
        const targetIdx = target.id
          ? targetMeals.findIndex((m) => m.mealId === String(target.id))
          : targetMeals.length;
        affectedDaysRef.current.add(src.dayOfWeek);
        affectedDaysRef.current.add(tgt.dayOfWeek);
        moveMealToDay(src.weekNum, src.dayOfWeek, tgt.dayOfWeek, String(source.id), targetIdx === -1 ? targetMeals.length : targetIdx);
      }
    },
    [plan, reorderMeals, moveMealToDay],
  );

  // onDragEnd: handle day drops + meal cleanup
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const dragData = activeDayDragRef.current;
    const lastGap = dayGapRef.current;
    activeDayDragRef.current = null;
    dayGapRef.current = null;
    setDayGapIndicator(null);

    // Meal drag cleanup
    affectedDaysRef.current = new Set();
    dragSourceGroupRef.current = null;

    if (!dragData || dragData.type !== 'day' || event.canceled) return;

    const state = useNutritionPlanStore.getState();
    const currentSelectedWeek = state.selectedWeek;

    // Gap drop = reorder within same week
    if (lastGap != null && dragData.weekNumber === currentSelectedWeek) {
      state.reorderDay(currentSelectedWeek, dragData.dayOfWeek, lastGap);
      return;
    }

    // Resolve target day from dnd-kit target or pointer
    const target = event.operation.target;
    const dropData = target?.data as Record<string, unknown> | undefined;
    if (dropData?.type === 'week-tab') return; // tabs are navigation only

    let targetDayOfWeek: number | null = (dropData?.dayOfWeek as number | null) ?? null;
    if (targetDayOfWeek == null) {
      // Pointer-based fallback
      const pointerX = event.operation.position.current.x;
      const dayCols = document.querySelectorAll<HTMLElement>('[data-nutrition-day]');
      for (const col of dayCols) {
        const rect = col.getBoundingClientRect();
        if (pointerX >= rect.left && pointerX <= rect.right) {
          targetDayOfWeek = Number(col.dataset.nutritionDay);
          break;
        }
      }
    }
    if (targetDayOfWeek == null) return;

    const sourceWeek = dragData.weekNumber;
    const targetWeek = currentSelectedWeek;

    // Same week + same day = no-op
    if (sourceWeek === targetWeek && dragData.dayOfWeek === targetDayOfWeek) return;

    // Check if target day has meals
    const targetWeekData = state.plan?.weeks.find((w) => w.weekNumber === targetWeek);
    const targetDay = targetWeekData?.days.find((d) => d.dayOfWeek === targetDayOfWeek);
    const hasMeals = (targetDay?.meals.length ?? 0) > 0;

    if (hasMeals) {
      setCopyDialog({ fromWeek: sourceWeek, from: dragData.dayOfWeek, toWeek: targetWeek, to: targetDayOfWeek });
    } else if (sourceWeek !== targetWeek) {
      state.copyDayToWeek(sourceWeek, dragData.dayOfWeek, targetWeek, targetDayOfWeek);
    } else {
      state.copyDayToDay(sourceWeek, dragData.dayOfWeek, targetDayOfWeek);
    }
  }, []);

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

      {/* Toolbar with tabs */}
      <PlanToolbar
        planName={plan.name}
        isDirty={isDirty}
        isSaving={isSaving}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSave={handleSave}
        startDate={plan.startDate}
        onStartDateChange={setStartDate}
        isStartDateLocked={isStartDateLocked}
      />

      {/* Tab content */}
      {activeTab === 'mealPlan' ? (
        <>
          {/* Day columns + week selector wrapped in single DragDropProvider */}
          <DragDropProvider
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleMealDragOver}
            onDragEnd={handleDragEnd}
          >
          {/* Week selector with hover-switch tabs */}
          <WeekSelector
            weeks={plan.weeks.map((w) => ({ weekNumber: w.weekNumber, status: w.status }))}
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
            onPublishWeek={handlePublishWeek}
            onAddWeek={addWeek}
            onRemoveWeek={() => removeWeek(selectedWeek)}
            renderTab={renderWeekTab}
            startDate={plan.startDate}
          />

          <div className="flex flex-1 overflow-x-auto p-4">
              {DAY_KEYS.map((key, idx) => {
                const dayOfWeek = idx + 1;
                const day = days.find((d) => d.dayOfWeek === dayOfWeek) ?? {
                  dayOfWeek,
                  meals: [],
                  dayTotals: null,
                };

                return (
                  <div key={dayOfWeek} className="flex">
                    {/* Gap indicator / spacer */}
                    {idx > 0 && (
                      <div className="flex w-3 shrink-0 items-stretch justify-center">
                        {dayGapIndicator === dayOfWeek && (
                          <div className="w-1.5 shrink-0 self-stretch rounded-full bg-gold animate-[slideIn_150ms_ease-out]" />
                        )}
                      </div>
                    )}

                    <NutritionDroppableDay dayOfWeek={dayOfWeek}>
                      <DayColumn
                        day={day}
                        weekNumber={selectedWeek}
                        dayLabel={t(`nutrition.${key}`)}
                        globalSettings={plan.globalSettings}
                        mealDistribution={mealDistribution}
                        dailyKcal={dailyKcal}
                        draggable
                      />
                    </NutritionDroppableDay>
                  </div>
                );
              })}
              {/* Gap indicator after last column */}
              <div className="flex w-3 shrink-0 items-stretch justify-center">
                {dayGapIndicator === 8 && (
                  <div className="w-1.5 shrink-0 self-stretch rounded-full bg-gold animate-[slideIn_150ms_ease-out]" />
                )}
              </div>
            </div>

          <NutritionDayOverlay />
          </DragDropProvider>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <NutritionGoalsTab clientId={plan.clientId} />
        </div>
      )}

      {/* Copy day confirmation dialog (same-week or cross-week with known target) */}
      {copyDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setCopyDialog(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-sm border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-sm font-bold">{t('training.copyDayTitle')}</h3>
            <p className="mt-2 text-sm text-text2">
              {copyDialog.fromWeek !== copyDialog.toWeek
                ? t('training.copyDayToWeek', {
                    fromDay: t(`nutrition.${DAY_KEYS[copyDialog.from - 1]}`),
                    fromWeek: copyDialog.fromWeek,
                    toDay: t(`nutrition.${DAY_KEYS[copyDialog.to - 1]}`),
                    toWeek: copyDialog.toWeek,
                  })
                : t('training.copyDayMessage', {
                    from: t(`nutrition.${DAY_KEYS[copyDialog.from - 1]}`),
                    to: t(`nutrition.${DAY_KEYS[copyDialog.to - 1]}`),
                  })}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setCopyDialog(null)}
                className="rounded-sm border border-border px-4 py-2 text-xs font-semibold text-text3 transition-colors hover:text-text"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCopyConfirm}
                className="rounded-sm bg-gold px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-gold-bright"
              >
                {t('training.copyDay')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

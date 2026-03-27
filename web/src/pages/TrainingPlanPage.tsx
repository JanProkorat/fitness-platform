import { useEffect, useCallback, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTrainingPlan } from '@/api/training-plans';
import { apiClient } from '@/api/client';
import { useTrainingPlanStore } from '@/stores/trainingPlan';
import { Breadcrumb, PageHeader } from '@/components/layout';
import { Button, Dialog, Input, Tag } from '@/components/ui';
import { ExerciseBlock } from '@/components/training';
import WeekSelector from '@/components/nutrition/WeekSelector';
import AddExercisesDrawer from '@/components/training/AddExercisesDrawer';
import type { StagedExercise } from '@/components/training/AddExercisesDrawer';
import TrainingDragProvider from '@/components/training/TrainingDragProvider';
import DraggableDayHeader from '@/components/training/DraggableDayHeader';
import DraggableSession from '@/components/training/DraggableSession';
import DraggableExercise from '@/components/training/DraggableExercise';
import DroppableSession from '@/components/training/DroppableSession';
import DroppableDay from '@/components/training/DroppableDay';
import WeekTab from '@/components/training/WeekTab';
import { useTrainingDrag } from '@/components/training/TrainingDragContext';
import { cn } from '@/lib/cn';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

// ---------------------------------------------------------------------------
// Drop indicator components (used inside DnD context)
// ---------------------------------------------------------------------------

/** Gold indicator line shown at session insertion point during drag. */
function SessionDropLine() {
  return (
    <div
      className="h-[2px] rounded-full bg-accent animate-[slideIn_150ms_ease-out]"
      style={{ margin: '2px 4px' }}
    />
  );
}

/** Reads the drag context and renders the indicator line at the correct position. */
function SessionDropIndicatorLine({ dayOfWeek, index }: { dayOfWeek: number; index: number }) {
  const { sessionIndicator } = useTrainingDrag();
  if (
    !sessionIndicator ||
    sessionIndicator.dayOfWeek !== dayOfWeek ||
    sessionIndicator.insertIndex !== index
  ) {
    return null;
  }
  return <SessionDropLine />;
}

/** Vertical gold line shown between day columns during day reorder drag. */
function DayGapIndicatorLine({ gapPosition }: { gapPosition: number }) {
  const { dayGapIndicator } = useTrainingDrag();
  if (dayGapIndicator !== gapPosition) return null;
  return (
    <div className="w-1.5 shrink-0 self-stretch rounded-full bg-accent animate-[slideIn_150ms_ease-out]" />
  );
}

/** Reads the drag context and renders the indicator line for exercises. */
function ExerciseDropIndicatorLine({
  sessionId,
  index,
}: {
  sessionId: string;
  index: number;
}) {
  const { exerciseIndicator } = useTrainingDrag();
  if (
    !exerciseIndicator ||
    exerciseIndicator.sessionId !== sessionId ||
    exerciseIndicator.insertIndex !== index
  ) {
    return null;
  }
  return <SessionDropLine />;
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function TrainingPlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const { t } = useTranslation();

  // ── Store selectors ──
  const plan = useTrainingPlanStore((s) => s.plan);
  const isDirty = useTrainingPlanStore((s) => s.isDirty);
  const isSaving = useTrainingPlanStore((s) => s.isSaving);
  const selectedWeek = useTrainingPlanStore((s) => s.selectedWeek);
  const setPlan = useTrainingPlanStore((s) => s.setPlan);
  const setSelectedWeek = useTrainingPlanStore((s) => s.setSelectedWeek);
  const save = useTrainingPlanStore((s) => s.save);
  const publishWeek = useTrainingPlanStore((s) => s.publishWeek);
  const addWeek = useTrainingPlanStore((s) => s.addWeek);
  const removeWeek = useTrainingPlanStore((s) => s.removeWeek);
  const copyDayToDay = useTrainingPlanStore((s) => s.copyDayToDay);
  const copyDayToWeek = useTrainingPlanStore((s) => s.copyDayToWeek);
  const addSession = useTrainingPlanStore((s) => s.addSession);
  const removeSession = useTrainingPlanStore((s) => s.removeSession);
  const addExercise = useTrainingPlanStore((s) => s.addExercise);
  const removeExercise = useTrainingPlanStore((s) => s.removeExercise);
  const duplicateExercise = useTrainingPlanStore((s) => s.duplicateExercise);
  const addSet = useTrainingPlanStore((s) => s.addSet);
  const removeSet = useTrainingPlanStore((s) => s.removeSet);
  const updateSet = useTrainingPlanStore((s) => s.updateSet);
  const updateSessionNotes = useTrainingPlanStore((s) => s.updateSessionNotes);
  const updateExerciseRestSeconds = useTrainingPlanStore(
    (s) => s.updateExerciseRestSeconds,
  );
  const revert = useTrainingPlanStore((s) => s.revert);
  const setStartDate = useTrainingPlanStore((s) => s.setStartDate);

  // ── Resolve client name ──
  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => apiClient.getClientsEndpoint(1, 200),
    enabled: !!plan?.clientId,
  });

  const clientName = useMemo(() => {
    if (!plan?.clientId || !clientsData?.clients) return null;
    const client = clientsData.clients.find(
      (c) => c.publicId === plan.clientId,
    );
    return client
      ? `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim()
      : null;
  }, [plan?.clientId, clientsData]);

  // ── Load plan on mount ──
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getTrainingPlan(planId);
        if (!cancelled) setPlan(data);
      } catch {
        // Plan load failed
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, setPlan]);

  // ── Unsaved changes warning ──
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSave = useCallback(() => save(), [save]);

  const handlePublishWeek = async () => {
    if (
      !window.confirm(
        t('training.confirmPublish', { number: selectedWeek }),
      )
    )
      return;
    await publishWeek(selectedWeek);
  };

  // ── Copy day dialog ──
  const [copyDialog, setCopyDialog] = useState<{
    fromWeek: number;
    from: number;
    toWeek: number;
    to: number;
  } | null>(null);

  const handleCopyDayDialog = useCallback(
    (fromWeek: number, fromDay: number, toWeek: number, toDay: number) => {
      setCopyDialog({ fromWeek, from: fromDay, toWeek, to: toDay });
    },
    [],
  );

  const handleCopyConfirm = () => {
    if (!copyDialog) return;
    if (copyDialog.fromWeek === copyDialog.toWeek) {
      copyDayToDay(copyDialog.fromWeek, copyDialog.from, copyDialog.to);
    } else {
      copyDayToWeek(
        copyDialog.fromWeek,
        copyDialog.from,
        copyDialog.toWeek,
        copyDialog.to,
      );
    }
    setCopyDialog(null);
  };

  // ── Revert confirmation ──
  const [confirmRevert, setConfirmRevert] = useState(false);

  // ── Collapse state ──
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(
    new Set(),
  );
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(
    new Set(),
  );

  const toggleSession = useCallback((sessionId: string) => {
    setCollapsedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }, []);

  const toggleExercise = useCallback((key: string) => {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Add-session inline form ──
  const [addingSessionDay, setAddingSessionDay] = useState<number | null>(
    null,
  );
  const [newSessionName, setNewSessionName] = useState('');

  // ── Add-exercises drawer ──
  const [exerciseDrawerSessionId, setExerciseDrawerSessionId] = useState<
    string | null
  >(null);

  const handleAddExercisesFromDrawer = useCallback(
    (exercises: StagedExercise[]) => {
      if (!exerciseDrawerSessionId) return;
      for (const ex of exercises) {
        addExercise(selectedWeek, exerciseDrawerSessionId, {
          exerciseExternalId: ex.exerciseExternalId,
          exerciseName: ex.exerciseName,
        });
        const store = useTrainingPlanStore.getState();
        const week = store.plan?.weeks.find(
          (w) => w.weekNumber === selectedWeek,
        );
        const session = week?.sessions.find(
          (s) => s.sessionId === exerciseDrawerSessionId,
        );
        if (session) {
          const exIdx = session.exercises.length - 1;
          for (let i = 1; i < ex.sets.length; i++) {
            addSet(selectedWeek, exerciseDrawerSessionId, exIdx);
          }
          for (let i = 0; i < ex.sets.length; i++) {
            const s = ex.sets[i];
            updateSet(selectedWeek, exerciseDrawerSessionId, exIdx, i, {
              reps: s.reps,
              weightKg: s.weightKg,
            });
          }
          if (ex.restSeconds != null) {
            updateExerciseRestSeconds(
              selectedWeek,
              exerciseDrawerSessionId,
              exIdx,
              ex.restSeconds,
            );
          }
        }
      }
      setExerciseDrawerSessionId(null);
    },
    [
      exerciseDrawerSessionId,
      selectedWeek,
      addExercise,
      addSet,
      updateSet,
      updateExerciseRestSeconds,
    ],
  );

  const handleAddSession = (dow: number) => {
    if (!newSessionName.trim()) return;
    addSession(selectedWeek, dow, newSessionName.trim());
    setNewSessionName('');
    setAddingSessionDay(null);
  };

  // ── WeekTab renderTab for WeekSelector ──
  const renderWeekTab = useCallback(
    (props: {
      weekNumber: number;
      status: 'Draft' | 'Published';
      isSelected: boolean;
    }) => <WeekTab {...props} />,
    [],
  );

  // ── Loading state ──
  if (!plan) {
    return (
      <div className="flex h-full items-center justify-center text-text3">
        {t('common.loading')}
      </div>
    );
  }

  const currentWeek =
    plan.weeks.find((w) => w.weekNumber === selectedWeek) ?? plan.weeks[0];
  const currentWeekStatus = currentWeek?.status ?? 'Draft';

  // ── Breadcrumb items ──
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Klienti', href: '/clients' },
    ...(clientName
      ? [
          {
            label: clientName,
            href: plan.clientId ? `/clients/${plan.clientId}` : undefined,
          },
        ]
      : []),
    { label: 'Treninkovy plan' },
  ];

  return (
    <TrainingDragProvider onCopyDayDialog={handleCopyDayDialog}>
      <div className="flex h-full flex-col bg-bg">
        {/* ── Breadcrumb ── */}
        <Breadcrumb items={breadcrumbItems} />

        {/* ── Page header ── */}
        <PageHeader
          icon="🏋️"
          title={plan.name}
          subtitle={
            [
              clientName,
              currentWeekStatus === 'Published' ? 'Publikovano' : 'Koncept',
            ]
              .filter(Boolean)
              .join(' · ')
          }
          actions={
            <div className="flex items-center gap-2">
              {/* Save indicator */}
              {isSaving && (
                <span className="text-xs text-text3">Ukladani...</span>
              )}
              {!isSaving && !isDirty && plan && (
                <span className="text-xs text-text4">Ulozeno</span>
              )}
              {isDirty && !isSaving && (
                <Tag variant="orange">Neulozen zmeny</Tag>
              )}

              {/* Start date */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-text3">Start:</span>
                <input
                  type="date"
                  value={plan.startDate?.slice(0, 10) ?? ''}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    if (val) {
                      const d = new Date(val + 'T00:00:00');
                      if (d.getDay() !== 1) return;
                    }
                    setStartDate(val);
                  }}
                  disabled={Boolean(
                    plan.startDate &&
                      plan.startDate.slice(0, 10) <
                        new Date().toISOString().slice(0, 10),
                  )}
                  className="rounded-md border border-border-md bg-bg px-2 py-[5px] text-[13px] text-text outline-none transition-colors duration-150 focus:border-border-hv disabled:cursor-not-allowed disabled:opacity-40"
                />
              </div>

              {/* Revert */}
              {isDirty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmRevert(true)}
                  disabled={isSaving}
                >
                  Zahodit zmeny
                </Button>
              )}

              {/* Save */}
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
              >
                {isSaving ? 'Ukladani...' : 'Ulozit'}
              </Button>
            </div>
          }
        />

        {/* ── Week tabs (toolbar area) ── */}
        <div className="flex items-center gap-2 border-b border-border px-20 py-2">
          {/* Week selector tabs */}
          <div className="flex flex-1 items-center gap-1 overflow-x-auto">
            {plan.weeks.map(({ weekNumber, status }) => {
              const isActive = weekNumber === selectedWeek;
              return (
                <div key={weekNumber}>
                  {renderWeekTab({
                    weekNumber,
                    status,
                    isSelected: isActive,
                  })}
                </div>
              );
            })}

            {/* Add week */}
            <button
              onClick={addWeek}
              className="ml-1 rounded-md px-2 py-[5px] text-xs text-text4 transition-colors duration-100 hover:bg-bg-hover hover:text-text3"
            >
              + Pridat tyden
            </button>
          </div>

          {/* Week actions */}
          <div className="flex shrink-0 items-center gap-2">
            {currentWeekStatus === 'Draft' && (
              <Button variant="primary" size="sm" onClick={handlePublishWeek}>
                Publikovat tyden {selectedWeek}
              </Button>
            )}
            {currentWeekStatus === 'Published' && (
              <Tag variant="green">Publikovano</Tag>
            )}
            {plan.weeks.length > 1 && currentWeekStatus !== 'Published' && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => removeWeek(selectedWeek)}
              >
                Odstranit tyden
              </Button>
            )}
          </div>
        </div>

        {/* ── Day columns (7-column week grid) ── */}
        <div className="flex flex-1 overflow-x-auto px-5 py-3">
          {DAY_KEYS.map((key, idx) => {
            const dayOfWeek = idx + 1;
            const sessions = (currentWeek?.sessions ?? [])
              .filter((s) => s.dayOfWeek === dayOfWeek)
              .sort((a, b) => a.order - b.order);
            const sessionCount = sessions.length;
            const exerciseCount = sessions.reduce(
              (sum, s) => sum + s.exercises.length,
              0,
            );
            const today = new Date().getDay();
            const isToday = (today === 0 ? 7 : today) === dayOfWeek;

            return (
              <div key={dayOfWeek} className="flex flex-1 min-w-[160px]">
                {/* Gap indicator / spacer before this column */}
                {idx > 0 && (
                  <div className="flex w-[6px] shrink-0 items-stretch justify-center">
                    <DayGapIndicatorLine gapPosition={dayOfWeek} />
                  </div>
                )}

                <DroppableDay dayOfWeek={dayOfWeek}>
                  {/* Day header */}
                  <DraggableDayHeader
                    weekNumber={selectedWeek}
                    dayOfWeek={dayOfWeek}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-between px-2 py-1.5 border-b border-border text-[11px] font-semibold uppercase tracking-[0.04em]',
                        isToday
                          ? 'text-blue bg-blue-bg'
                          : 'text-text3 bg-bg2',
                      )}
                    >
                      <span>{t(`nutrition.${key}`)}</span>
                      <span className="text-[10px] font-normal text-text4">
                        {sessionCount}s · {exerciseCount}cv
                      </span>
                    </div>
                  </DraggableDayHeader>

                  {/* Session list */}
                  <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-1.5">
                    {sessions.length === 0 && (
                      <div className="py-6 text-center text-xs text-text4">
                        Odpocinek
                      </div>
                    )}

                    {sessions.map((session, sessionIdx) => (
                      <div
                        key={session.sessionId}
                        data-session-idx={sessionIdx}
                      >
                        {/* Drop indicator before this session */}
                        <SessionDropIndicatorLine
                          dayOfWeek={dayOfWeek}
                          index={sessionIdx}
                        />

                        <DraggableSession
                          weekNumber={selectedWeek}
                          sessionId={session.sessionId}
                          dayOfWeek={dayOfWeek}
                        >
                          <div className="flex flex-col rounded-md border border-border bg-bg2 transition-all duration-100 hover:border-border-md">
                            {/* Session header — click to collapse */}
                            <div
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-[6px] cursor-grab active:cursor-grabbing select-none transition-colors hover:bg-bg3',
                                !collapsedSessions.has(session.sessionId) &&
                                  'border-b border-border',
                              )}
                              onClick={() =>
                                toggleSession(session.sessionId)
                              }
                            >
                              <span
                                className={cn(
                                  'text-[10px] text-text3 transition-transform duration-150 w-3 inline-flex items-center justify-center',
                                  !collapsedSessions.has(
                                    session.sessionId,
                                  ) && 'rotate-90',
                                )}
                              >
                                ▶
                              </span>
                              <span className="flex-1 text-[11px] font-semibold text-text truncate">
                                {session.name}
                              </span>
                              <span className="text-[9px] text-text4">
                                {session.exercises.length} cv
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSession(
                                    selectedWeek,
                                    session.sessionId,
                                  );
                                }}
                                className="opacity-0 group-hover:opacity-100 text-text4 transition-all duration-100 hover:text-red rounded-sm p-0.5"
                              >
                                <svg
                                  className="h-3 w-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>

                            {/* Session body — animated collapse */}
                            <div
                              className="collapse-grid"
                              data-open={
                                !collapsedSessions.has(session.sessionId)
                              }
                            >
                              <div className="collapse-content">
                                {/* Session notes */}
                                <div className="border-b border-border px-2.5 py-1.5">
                                  <textarea
                                    value={session.notes ?? ''}
                                    onChange={(e) =>
                                      updateSessionNotes(
                                        selectedWeek,
                                        session.sessionId,
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Poznamky k treninku..."
                                    rows={1}
                                    className="w-full resize-none bg-transparent text-[11px] text-text3 outline-none placeholder:text-text4"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>

                                {/* Exercises — droppable container */}
                                <DroppableSession
                                  sessionId={session.sessionId}
                                  dayOfWeek={dayOfWeek}
                                >
                                  {session.exercises.map((ex, exIdx) => (
                                    <div
                                      key={`ex-${session.sessionId}-${exIdx}`}
                                      data-exercise-idx={exIdx}
                                    >
                                      <ExerciseDropIndicatorLine
                                        sessionId={session.sessionId}
                                        index={exIdx}
                                      />
                                      <DraggableExercise
                                        weekNumber={selectedWeek}
                                        sessionId={session.sessionId}
                                        exerciseIndex={exIdx}
                                        exercise={ex}
                                      >
                                        <div className="rounded-md border border-border bg-bg p-1.5 cursor-grab active:cursor-grabbing transition-all duration-100 hover:border-border-md">
                                          {/* Exercise header */}
                                          <div
                                            className="flex items-center justify-between cursor-pointer select-none"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleExercise(
                                                `${session.sessionId}-${exIdx}`,
                                              );
                                            }}
                                          >
                                            <div className="flex items-center gap-1 min-w-0 flex-1">
                                              <span
                                                className={cn(
                                                  'text-[9px] text-text3 transition-transform duration-150 w-2.5 inline-flex items-center justify-center',
                                                  !collapsedExercises.has(
                                                    `${session.sessionId}-${exIdx}`,
                                                  ) && 'rotate-90',
                                                )}
                                              >
                                                ▶
                                              </span>
                                              <span className="text-[11px] font-semibold text-text2 truncate">
                                                {ex.exerciseName}
                                              </span>
                                              {ex.restSeconds != null &&
                                                ex.restSeconds > 0 && (
                                                  <span className="shrink-0 text-[9px] text-accent">
                                                    {ex.restSeconds}s
                                                  </span>
                                                )}
                                              <span className="shrink-0 text-[9px] text-text4">
                                                {ex.sets.length}s
                                              </span>
                                            </div>
                                            <div
                                              className="flex items-center gap-0.5"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                            >
                                              <button
                                                onClick={() =>
                                                  duplicateExercise(
                                                    selectedWeek,
                                                    session.sessionId,
                                                    exIdx,
                                                  )
                                                }
                                                className="opacity-0 group-hover:opacity-100 text-text4 transition-all duration-100 hover:text-accent rounded-sm p-0.5"
                                                title="Duplikovat"
                                              >
                                                <svg
                                                  className="h-2.5 w-2.5"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                  />
                                                </svg>
                                              </button>
                                              <button
                                                onClick={() =>
                                                  removeExercise(
                                                    selectedWeek,
                                                    session.sessionId,
                                                    exIdx,
                                                  )
                                                }
                                                className="opacity-0 group-hover:opacity-100 text-text4 transition-all duration-100 hover:text-red rounded-sm p-0.5"
                                                title="Odstranit"
                                              >
                                                <svg
                                                  className="h-2.5 w-2.5"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M6 18L18 6M6 6l12 12"
                                                  />
                                                </svg>
                                              </button>
                                            </div>
                                          </div>

                                          {/* Sets table — animated collapse */}
                                          <div
                                            className="collapse-grid"
                                            data-open={
                                              !collapsedExercises.has(
                                                `${session.sessionId}-${exIdx}`,
                                              )
                                            }
                                          >
                                            <div className="collapse-content">
                                              {/* Sets header */}
                                              <div className="flex items-center gap-2 mb-0.5 px-0.5 mt-1.5">
                                                <span className="w-4 text-[9px] font-medium text-text3 uppercase">
                                                  #
                                                </span>
                                                <span className="flex-1 text-[9px] font-medium text-text3 uppercase">
                                                  Opak.
                                                </span>
                                                <span className="flex-1 text-[9px] font-medium text-text3 uppercase">
                                                  Vaha
                                                </span>
                                                <span className="w-4" />
                                              </div>

                                              {/* Set rows */}
                                              {ex.sets.map((s, sIdx) => (
                                                <div
                                                  key={sIdx}
                                                  className="flex items-center gap-2 mb-0.5 group/set"
                                                >
                                                  <span className="w-4 text-center text-[10px] font-mono text-text4">
                                                    {s.setNumber}
                                                  </span>
                                                  <input
                                                    type="number"
                                                    placeholder="--"
                                                    value={s.reps ?? ''}
                                                    onChange={(e) =>
                                                      updateSet(
                                                        selectedWeek,
                                                        session.sessionId,
                                                        exIdx,
                                                        sIdx,
                                                        {
                                                          reps: e.target.value
                                                            ? Number(
                                                                e.target.value,
                                                              )
                                                            : null,
                                                        },
                                                      )
                                                    }
                                                    className="flex-1 rounded-sm bg-transparent px-1 py-[1px] text-center text-[11px] text-text outline-none transition-colors hover:bg-bg-hover focus:bg-bg-active focus:ring-1 focus:ring-border-md"
                                                  />
                                                  <input
                                                    type="number"
                                                    placeholder="--"
                                                    value={s.weightKg ?? ''}
                                                    onChange={(e) =>
                                                      updateSet(
                                                        selectedWeek,
                                                        session.sessionId,
                                                        exIdx,
                                                        sIdx,
                                                        {
                                                          weightKg: e.target
                                                            .value
                                                            ? Number(
                                                                e.target.value,
                                                              )
                                                            : null,
                                                        },
                                                      )
                                                    }
                                                    className="flex-1 rounded-sm bg-transparent px-1 py-[1px] text-center text-[11px] text-text outline-none transition-colors hover:bg-bg-hover focus:bg-bg-active focus:ring-1 focus:ring-border-md"
                                                  />
                                                  <button
                                                    onClick={() =>
                                                      removeSet(
                                                        selectedWeek,
                                                        session.sessionId,
                                                        exIdx,
                                                        sIdx,
                                                      )
                                                    }
                                                    className="w-4 text-center text-[10px] text-text4 opacity-0 group-hover/set:opacity-100 transition-all duration-100 hover:text-red"
                                                  >
                                                    &times;
                                                  </button>
                                                </div>
                                              ))}

                                              {/* Add set */}
                                              <div
                                                className="mt-1 text-[10px] text-text4 cursor-pointer transition-colors hover:text-text3"
                                                onClick={() =>
                                                  addSet(
                                                    selectedWeek,
                                                    session.sessionId,
                                                    exIdx,
                                                  )
                                                }
                                              >
                                                + Pridat serii
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </DraggableExercise>
                                    </div>
                                  ))}

                                  {/* Drop indicator after last exercise */}
                                  <ExerciseDropIndicatorLine
                                    sessionId={session.sessionId}
                                    index={session.exercises.length}
                                  />

                                  {/* Add exercise button */}
                                  <div
                                    className="text-xs text-text4 text-center p-1 cursor-pointer rounded-sm transition-colors duration-100 hover:bg-bg-hover hover:text-text3"
                                    onClick={() =>
                                      setExerciseDrawerSessionId(
                                        session.sessionId,
                                      )
                                    }
                                  >
                                    + Pridat cvik
                                  </div>
                                </DroppableSession>
                              </div>
                            </div>
                          </div>
                        </DraggableSession>
                      </div>
                    ))}

                    {/* Drop indicator after last session */}
                    <SessionDropIndicatorLine
                      dayOfWeek={dayOfWeek}
                      index={sessions.length}
                    />

                    {/* Add session */}
                    {addingSessionDay === dayOfWeek ? (
                      <div className="flex gap-1">
                        <input
                          autoFocus
                          value={newSessionName}
                          onChange={(e) => setNewSessionName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === 'Enter' && handleAddSession(dayOfWeek)
                          }
                          placeholder="Nazev treninku..."
                          className="flex-1 rounded-md border border-border-md bg-bg px-2 py-[5px] text-[13px] text-text outline-none transition-colors duration-150 placeholder:text-text3 focus:border-border-hv"
                        />
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleAddSession(dayOfWeek)}
                        >
                          +
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingSessionDay(null);
                            setNewSessionName('');
                          }}
                        >
                          &times;
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="text-xs text-text4 text-center p-1 cursor-pointer rounded-sm transition-colors duration-100 hover:bg-bg-hover hover:text-text3"
                        onClick={() => setAddingSessionDay(dayOfWeek)}
                      >
                        + Pridat
                      </div>
                    )}
                  </div>
                </DroppableDay>
              </div>
            );
          })}

          {/* Gap indicator after last column */}
          <div className="flex w-[6px] shrink-0 items-stretch justify-center">
            <DayGapIndicatorLine gapPosition={8} />
          </div>
        </div>

        {/* ── Revert confirmation dialog ── */}
        <Dialog
          open={confirmRevert}
          onClose={() => setConfirmRevert(false)}
          title="Zahodit zmeny"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmRevert(false)}>
                Zrusit
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  revert();
                  setConfirmRevert(false);
                }}
              >
                Zahodit zmeny
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-text2">
            Opravdu chcete zahodit vsechny neulozen zmeny? Tato akce nelze
            vratit.
          </p>
        </Dialog>

        {/* ── Copy day confirmation dialog ── */}
        <Dialog
          open={copyDialog !== null}
          onClose={() => setCopyDialog(null)}
          title="Kopirovat den"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCopyDialog(null)}>
                Zrusit
              </Button>
              <Button variant="primary" onClick={handleCopyConfirm}>
                Kopirovat
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-text2">
            {copyDialog &&
              (copyDialog.fromWeek !== copyDialog.toWeek
                ? t('training.copyDayToWeek', {
                    fromDay: t(
                      `nutrition.${DAY_KEYS[copyDialog.from - 1]}`,
                    ),
                    fromWeek: copyDialog.fromWeek,
                    toDay: t(`nutrition.${DAY_KEYS[copyDialog.to - 1]}`),
                    toWeek: copyDialog.toWeek,
                  })
                : t('training.copyDayMessage', {
                    from: t(
                      `nutrition.${DAY_KEYS[copyDialog.from - 1]}`,
                    ),
                    to: t(`nutrition.${DAY_KEYS[copyDialog.to - 1]}`),
                  }))}
          </p>
        </Dialog>

        {/* ── Add exercises drawer ── */}
        <AddExercisesDrawer
          open={exerciseDrawerSessionId !== null}
          onClose={() => setExerciseDrawerSessionId(null)}
          onAdd={handleAddExercisesFromDrawer}
        />
      </div>
    </TrainingDragProvider>
  );
}

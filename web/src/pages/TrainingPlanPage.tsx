import { useEffect, useCallback, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTrainingPlan } from '@/api/training-plans';
import { apiClient } from '@/api/client';
import { useTrainingPlanStore } from '@/stores/trainingPlan';
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

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/// Gold indicator line shown at session insertion point during drag.
function SessionDropLine() {
  return <div className="h-0.5 rounded-full bg-gold animate-[slideIn_150ms_ease-out]" style={{ margin: '2px 4px' }} />;
}

/// Reads the drag context and renders the indicator line at the correct position.
function SessionDropIndicatorLine({ dayOfWeek, index }: { dayOfWeek: number; index: number }) {
  const { sessionIndicator } = useTrainingDrag();
  if (!sessionIndicator || sessionIndicator.dayOfWeek !== dayOfWeek || sessionIndicator.insertIndex !== index) {
    return null;
  }
  return <SessionDropLine />;
}

/// Vertical gold line shown between day columns during day reorder drag.
function DayGapIndicatorLine({ gapPosition }: { gapPosition: number }) {
  const { dayGapIndicator } = useTrainingDrag();
  if (dayGapIndicator !== gapPosition) return null;
  return <div className="w-1.5 shrink-0 self-stretch rounded-full bg-gold animate-[slideIn_150ms_ease-out]" />;
}

/// Reads the drag context and renders the indicator line for exercises.
function ExerciseDropIndicatorLine({ sessionId, index }: { sessionId: string; index: number }) {
  const { exerciseIndicator } = useTrainingDrag();
  if (!exerciseIndicator || exerciseIndicator.sessionId !== sessionId || exerciseIndicator.insertIndex !== index) {
    return null;
  }
  return <SessionDropLine />;
}

export default function TrainingPlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const { t } = useTranslation();

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
  const updateExerciseRestSeconds = useTrainingPlanStore((s) => s.updateExerciseRestSeconds);
  const revert = useTrainingPlanStore((s) => s.revert);
  const setStartDate = useTrainingPlanStore((s) => s.setStartDate);

  // Resolve client name
  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => apiClient.getClientsEndpoint(1, 200),
    enabled: !!plan?.clientId,
  });

  const clientName = useMemo(() => {
    if (!plan?.clientId || !clientsData?.clients) return null;
    const client = clientsData.clients.find((c) => c.publicId === plan.clientId);
    return client ? `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim() : null;
  }, [plan?.clientId, clientsData]);

  // Load plan on mount
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
    return () => { cancelled = true; };
  }, [planId, setPlan]);

  // Unsaved changes warning
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSave = useCallback(() => save(), [save]);

  const handlePublishWeek = async () => {
    if (!window.confirm(t('training.confirmPublish', { number: selectedWeek }))) return;
    await publishWeek(selectedWeek);
  };

  // Copy day dialog (used for same-week copy AND cross-week copy to non-empty target)
  const [copyDialog, setCopyDialog] = useState<{ fromWeek: number; from: number; toWeek: number; to: number } | null>(null);

  const handleCopyDayDialog = useCallback((fromWeek: number, fromDay: number, toWeek: number, toDay: number) => {
    setCopyDialog({ fromWeek, from: fromDay, toWeek, to: toDay });
  }, []);

  const handleCopyConfirm = () => {
    if (!copyDialog) return;
    if (copyDialog.fromWeek === copyDialog.toWeek) {
      copyDayToDay(copyDialog.fromWeek, copyDialog.from, copyDialog.to);
    } else {
      copyDayToWeek(copyDialog.fromWeek, copyDialog.from, copyDialog.toWeek, copyDialog.to);
    }
    setCopyDialog(null);
  };

  // Revert confirmation
  const [confirmRevert, setConfirmRevert] = useState(false);

  // Collapse state
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());

  const toggleSession = useCallback((sessionId: string) => {
    setCollapsedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId); else next.add(sessionId);
      return next;
    });
  }, []);

  const toggleExercise = useCallback((key: string) => {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Add-session inline form
  const [addingSessionDay, setAddingSessionDay] = useState<number | null>(null);
  const [newSessionName, setNewSessionName] = useState('');

  // Add-exercises drawer
  const [exerciseDrawerSessionId, setExerciseDrawerSessionId] = useState<string | null>(null);

  const handleAddExercisesFromDrawer = useCallback((exercises: StagedExercise[]) => {
    if (!exerciseDrawerSessionId) return;
    for (const ex of exercises) {
      addExercise(selectedWeek, exerciseDrawerSessionId, {
        exerciseExternalId: ex.exerciseExternalId,
        exerciseName: ex.exerciseName,
      });
      const store = useTrainingPlanStore.getState();
      const week = store.plan?.weeks.find((w) => w.weekNumber === selectedWeek);
      const session = week?.sessions.find((s) => s.sessionId === exerciseDrawerSessionId);
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
          updateExerciseRestSeconds(selectedWeek, exerciseDrawerSessionId, exIdx, ex.restSeconds);
        }
      }
    }
    setExerciseDrawerSessionId(null);
  }, [exerciseDrawerSessionId, selectedWeek, addExercise, addSet, updateSet, updateExerciseRestSeconds]);

  const handleAddSession = (dow: number) => {
    if (!newSessionName.trim()) return;
    addSession(selectedWeek, dow, newSessionName.trim());
    setNewSessionName('');
    setAddingSessionDay(null);
  };

  // WeekTab renderTab for WeekSelector
  const renderWeekTab = useCallback(
    (props: { weekNumber: number; status: 'Draft' | 'Published'; isSelected: boolean }) => (
      <WeekTab {...props} />
    ),
    [],
  );

  if (!plan) {
    return (
      <div className="flex h-full items-center justify-center text-text3">
        {t('common.loading')}
      </div>
    );
  }

  const currentWeek = plan.weeks.find((w) => w.weekNumber === selectedWeek) ?? plan.weeks[0];

  return (
    <TrainingDragProvider onCopyDayDialog={handleCopyDayDialog}>
      <div className="flex h-full flex-col">
        {/* Back link */}
        <div className="border-b border-border bg-[#111111] px-6 py-2">
          <Link
            to="/training-plans"
            className="font-heading text-xs font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
          >
            &larr; {t('training.backToPlans')}
          </Link>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 border-b border-border bg-[#111111] px-6 py-3">
          <h1 className="flex-1 truncate font-heading text-sm font-bold uppercase tracking-wide">
            {clientName && <span className="text-gold">{clientName}</span>}
            {clientName && <span className="mx-1.5 text-text3">—</span>}
            {plan.name}
          </h1>
          <div className="flex items-center gap-2">
            <label className="font-heading text-[10px] font-semibold uppercase tracking-wide text-text3">
              {t('training.startDate')}
            </label>
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
              disabled={Boolean(plan.startDate && plan.startDate.slice(0, 10) < new Date().toISOString().slice(0, 10))}
              className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-text outline-none transition-colors focus:border-gold/40 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
          {isDirty && (
            <>
              <span className="rounded-sm bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
                {t('training.unsaved')}
              </span>
              <button
                onClick={() => setConfirmRevert(true)}
                disabled={isSaving}
                className="rounded-sm border border-border px-4 py-2 font-heading text-[12px] font-semibold uppercase tracking-wide text-text3 transition-colors hover:text-text disabled:opacity-50"
              >
                {t('training.revert')}
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="rounded-sm bg-gold px-4 py-2 font-heading text-[12px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
        </div>

        {/* Week selector with droppable tabs */}
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

        {/* Day columns */}
        <div className="flex flex-1 overflow-x-auto p-4">
          {DAY_KEYS.map((key, idx) => {
            const dayOfWeek = idx + 1;
            const sessions = (currentWeek?.sessions ?? [])
              .filter((s) => s.dayOfWeek === dayOfWeek)
              .sort((a, b) => a.order - b.order);
            const sessionCount = sessions.length;
            const exerciseCount = sessions.reduce((sum, s) => sum + s.exercises.length, 0);

            return (
              <div key={dayOfWeek} className="flex">
                {/* Gap indicator / spacer before this column */}
                {idx > 0 && (
                  <div className="flex w-3 shrink-0 items-stretch justify-center">
                    <DayGapIndicatorLine gapPosition={dayOfWeek} />
                  </div>
                )}

                <DroppableDay dayOfWeek={dayOfWeek}>
                  {/* Day header — drag handle */}
                  <DraggableDayHeader weekNumber={selectedWeek} dayOfWeek={dayOfWeek}>
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-xs font-bold uppercase tracking-wide">
                        {t(`nutrition.${key}`)}
                      </span>
                      <span className="text-[10px] text-text3">
                        {sessionCount} {t('training.sessions')} · {exerciseCount} {t('training.exercisesCount')}
                      </span>
                    </div>
                  </DraggableDayHeader>

                  {/* Sessions */}
                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                    {sessions.length === 0 && (
                      <div className="py-6 text-center text-xs text-text3">{t('training.noSessions')}</div>
                    )}

                    {sessions.map((session, sessionIdx) => (
                      <div key={session.sessionId} data-session-idx={sessionIdx}>
                        {/* Drop indicator before this session */}
                        <SessionDropIndicatorLine dayOfWeek={dayOfWeek} index={sessionIdx} />
                      <DraggableSession
                        weekNumber={selectedWeek}
                        sessionId={session.sessionId}
                        dayOfWeek={dayOfWeek}
                      >
                        <div className="flex flex-col rounded-sm border border-border bg-[#1a1a1a] transition-all duration-200">
                          {/* Session header — click to collapse */}
                          <div
                            className={`flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none ${collapsedSessions.has(session.sessionId) ? '' : 'border-b border-border'}`}
                            onClick={() => toggleSession(session.sessionId)}
                          >
                            <svg
                              className={`h-3 w-3 shrink-0 text-text3 transition-transform duration-200 ${collapsedSessions.has(session.sessionId) ? '' : 'rotate-90'}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="flex-1 text-sm font-semibold text-text truncate">
                              {session.name}
                            </span>
                            <span className="text-[9px] text-text3">
                              {session.exercises.length} {t('training.exercisesCount')}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeSession(selectedWeek, session.sessionId); }}
                              className="text-text3 transition-colors hover:text-red-400"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          {/* Session body — animated collapse */}
                          <div className="collapse-grid" data-open={!collapsedSessions.has(session.sessionId)}>
                          <div className="collapse-content">
                          {/* Session notes */}
                          <div className="border-b border-border px-3 py-1.5">
                            <textarea
                              value={session.notes ?? ''}
                              onChange={(e) => updateSessionNotes(selectedWeek, session.sessionId, e.target.value)}
                              placeholder={t('training.sessionNotesPlaceholder')}
                              rows={1}
                              className="w-full resize-none bg-transparent text-[11px] text-text3 outline-none placeholder:text-muted"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          {/* Exercises — droppable container with sortable items */}
                          <DroppableSession sessionId={session.sessionId} dayOfWeek={dayOfWeek}>
                            {session.exercises.map((ex, exIdx) => (
                              <div key={`ex-${session.sessionId}-${exIdx}`} data-exercise-idx={exIdx}>
                                <ExerciseDropIndicatorLine sessionId={session.sessionId} index={exIdx} />
                              <DraggableExercise
                                weekNumber={selectedWeek}
                                sessionId={session.sessionId}
                                exerciseIndex={exIdx}
                                exercise={ex}
                              >
                                <div className="rounded-sm border border-charcoal bg-bg p-2 cursor-grab active:cursor-grabbing transition-all duration-200">
                                  <div
                                    className="flex items-center justify-between cursor-pointer select-none"
                                    onClick={(e) => { e.stopPropagation(); toggleExercise(`${session.sessionId}-${exIdx}`); }}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <svg
                                        className={`h-2.5 w-2.5 shrink-0 text-text3 transition-transform duration-200 ${collapsedExercises.has(`${session.sessionId}-${exIdx}`) ? '' : 'rotate-90'}`}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <span className="text-[11px] font-semibold text-text2 truncate">{ex.exerciseName}</span>
                                      {ex.restSeconds != null && ex.restSeconds > 0 && (
                                        <span className="shrink-0 text-[9px] text-gold">⏱ {ex.restSeconds}s</span>
                                      )}
                                      <span className="shrink-0 text-[9px] text-text3">{ex.sets.length}s</span>
                                    </div>
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => duplicateExercise(selectedWeek, session.sessionId, exIdx)}
                                        className="text-text3 transition-colors hover:text-gold"
                                        title={t('training.duplicateExercise')}
                                      >
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => removeExercise(selectedWeek, session.sessionId, exIdx)}
                                        className="text-text3 transition-colors hover:text-red-400"
                                        title={t('training.removeExercise')}
                                      >
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Sets table — animated collapse */}
                                  <div className="collapse-grid" data-open={!collapsedExercises.has(`${session.sessionId}-${exIdx}`)}>
                                  <div className="collapse-content">
                                  <div className="flex items-center gap-2 mb-1 px-0.5 mt-1.5">
                                    <span className="w-5 text-[9px] font-bold text-text3 uppercase">#</span>
                                    <span className="flex-1 text-[9px] font-bold text-text3 uppercase">{t('training.reps')}</span>
                                    <span className="flex-1 text-[9px] font-bold text-text3 uppercase">{t('training.kg')}</span>
                                    <span className="w-4" />
                                  </div>
                                  {ex.sets.map((s, sIdx) => (
                                    <div key={sIdx} className="flex items-center gap-2 mb-0.5">
                                      <span className="w-5 text-center text-[10px] font-mono text-text3">{s.setNumber}</span>
                                      <input
                                        type="number"
                                        placeholder="—"
                                        value={s.reps ?? ''}
                                        onChange={(e) => updateSet(selectedWeek, session.sessionId, exIdx, sIdx, { reps: e.target.value ? Number(e.target.value) : null })}
                                        className="flex-1 rounded-sm border border-charcoal bg-surface px-1.5 py-1 text-center text-[11px] text-text outline-none focus:border-gold/40"
                                      />
                                      <input
                                        type="number"
                                        placeholder="—"
                                        value={s.weightKg ?? ''}
                                        onChange={(e) => updateSet(selectedWeek, session.sessionId, exIdx, sIdx, { weightKg: e.target.value ? Number(e.target.value) : null })}
                                        className="flex-1 rounded-sm border border-charcoal bg-surface px-1.5 py-1 text-center text-[11px] text-text outline-none focus:border-gold/40"
                                      />
                                      <button
                                        onClick={() => removeSet(selectedWeek, session.sessionId, exIdx, sIdx)}
                                        className="w-4 text-center text-[10px] text-text3 transition-colors hover:text-red-400"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => addSet(selectedWeek, session.sessionId, exIdx)}
                                    className="mt-1 text-[10px] text-gold-dim transition-colors hover:text-gold"
                                  >
                                    + {t('training.addSet')}
                                  </button>
                                  </div>
                                  </div>
                                </div>
                              </DraggableExercise>
                              </div>
                            ))}

                            {/* Drop indicator after last exercise */}
                            <ExerciseDropIndicatorLine sessionId={session.sessionId} index={session.exercises.length} />

                            {/* Add exercise — opens search drawer */}
                            <button
                              onClick={() => setExerciseDrawerSessionId(session.sessionId)}
                              className="w-full rounded-sm border border-border bg-[#222] py-1.5 text-[9px] font-semibold uppercase text-text3 transition-colors hover:text-gold"
                            >
                              + {t('training.addExercise')}
                            </button>
                          </DroppableSession>
                          </div>
                          </div>
                        </div>
                      </DraggableSession>
                      </div>
                    ))}

                    {/* Drop indicator after last session */}
                    <SessionDropIndicatorLine dayOfWeek={dayOfWeek} index={sessions.length} />

                    {/* Add session */}
                    {addingSessionDay === dayOfWeek ? (
                      <div className="flex gap-1.5">
                        <input
                          autoFocus
                          value={newSessionName}
                          onChange={(e) => setNewSessionName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddSession(dayOfWeek)}
                          placeholder={t('training.sessionNamePlaceholder')}
                          className="flex-1 rounded-sm border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-gold/40"
                        />
                        <button
                          onClick={() => handleAddSession(dayOfWeek)}
                          className="rounded-sm bg-gold px-2 py-1.5 text-[10px] font-bold text-black"
                        >
                          +
                        </button>
                        <button
                          onClick={() => { setAddingSessionDay(null); setNewSessionName(''); }}
                          className="rounded-sm border border-border px-2 py-1.5 text-[10px] text-text3"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingSessionDay(dayOfWeek)}
                        className="py-1 text-xs font-semibold text-gold-dim transition-colors hover:text-gold"
                      >
                        {t('training.addSession')}
                      </button>
                    )}
                  </div>
                </DroppableDay>
              </div>
            );
          })}
          {/* Gap indicator after last column */}
          <div className="flex w-3 shrink-0 items-stretch justify-center">
            <DayGapIndicatorLine gapPosition={8} />
          </div>
        </div>

        {/* Revert confirmation dialog */}
        {confirmRevert && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60" onClick={() => setConfirmRevert(false)} />
            <div className="relative z-10 w-full max-w-sm rounded-sm border border-border bg-surface p-6 shadow-2xl">
              <h3 className="text-sm font-bold">{t('training.revertTitle')}</h3>
              <p className="mt-2 text-sm text-text2">{t('training.revertMessage')}</p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setConfirmRevert(false)}
                  className="rounded-sm border border-border px-4 py-2 text-xs font-semibold text-text3 transition-colors hover:text-text"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => { revert(); setConfirmRevert(false); }}
                  className="rounded-sm bg-red-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-600"
                >
                  {t('training.revert')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Copy day confirmation dialog */}
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

        {/* Add exercises drawer */}
        <AddExercisesDrawer
          open={exerciseDrawerSessionId !== null}
          onClose={() => setExerciseDrawerSessionId(null)}
          onAdd={handleAddExercisesFromDrawer}
        />
      </div>
    </TrainingDragProvider>
  );
}

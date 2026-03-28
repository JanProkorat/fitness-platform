import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTrainingPlan } from '@/api/training-plans';
import { apiClient } from '@/api/client';
import { useTrainingPlanStore } from '@/stores/trainingPlan';
import { Breadcrumb, PageHeader } from '@/components/layout';
import { Button, Dialog } from '@/components/ui';
import { ExerciseSearch } from '@/components/training/ExerciseSearch';
import { WeekDayTabs } from '@/components/nutrition';
import type { WeekTabData } from '@/components/nutrition/WeekDayTabs';
import { TrainingSidebar } from '@/components/training/TrainingSidebar';
import { cn } from '@/lib/cn';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Day-level note input — identical to the one in NutritionPlanPage */
function DayNoteInput({ note, onChange, addLabel, placeholder }: { note?: string | null; onChange: (note: string) => void; addLabel: string; placeholder: string }) {
  const [value, setValue] = useState(note ?? '');
  const [open, setOpen] = useState(!!note);

  // Sync when day changes
  useEffect(() => {
    setValue(note ?? '');
    if (note) setOpen(true);
    else setOpen(false);
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

/** Draggable session wrapper — mirrors SortableMealItem from the nutrition plan. */
function SessionDragWrapper({
  sessionId, selectedDay, selectedWeek, children,
}: {
  sessionId: string; selectedDay: number; selectedWeek: number; children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/session-json', JSON.stringify({ type: 'session', sessionId, fromDay: selectedDay, fromWeek: selectedWeek }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/session-json')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (!e.dataTransfer.types.includes('application/session-json')) return;
        e.preventDefault();
        // reorder handled by parent container
      }}
      data-session-id={sessionId}
      className="mb-4"
      style={{
        borderTop: over ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'border-color 0.1s',
      }}
    >
      {children}
    </div>
  );
}

/** Drop zone wrapping exercise rows — mirrors MealDropZone from the nutrition plan. */
function ExerciseDropZone({
  sessionId, exerciseIds, selectedWeek, onReorder, onCrossSessionMove, children,
}: {
  sessionId: string;
  exerciseIds: string[];
  selectedWeek: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onCrossSessionMove: (fromSessionId: string, fromIndex: number, toIndex: number, fromWeek: number) => void;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      style={{
        minHeight: 24,
        borderRadius: 'var(--radius)',
        transition: 'background 0.15s',
        background: over ? 'var(--accent-bg)' : undefined,
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/exercise-json')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (!e.dataTransfer.types.includes('application/exercise-json')) return;
        e.preventDefault();
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/exercise-json'));
          if (data.type !== 'exercise') return;

          // Find target index from mouse position
          const container = e.currentTarget;
          const rows = Array.from(container.querySelectorAll('[data-item-id]'));
          let targetIndex = rows.length;
          for (let i = 0; i < rows.length; i++) {
            const rect = rows[i].getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
              targetIndex = i;
              break;
            }
          }

          const fromWeek = data.fromWeek ?? selectedWeek;

          if (data.sessionId === sessionId && fromWeek === selectedWeek) {
            // Same session reorder
            const fromIndex = data.exerciseIndex;
            if (fromIndex !== targetIndex) {
              onReorder(fromIndex, targetIndex > fromIndex ? targetIndex - 1 : targetIndex);
            }
          } else {
            // Cross-session or cross-week move
            onCrossSessionMove(data.sessionId, data.exerciseIndex, targetIndex, fromWeek);
          }
        } catch { /* ignore */ }
      }}
    >
      {children}
    </div>
  );
}

export default function TrainingPlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

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
  const addSession = useTrainingPlanStore((s) => s.addSession);
  const removeSession = useTrainingPlanStore((s) => s.removeSession);
  const addExercise = useTrainingPlanStore((s) => s.addExercise);
  const removeExercise = useTrainingPlanStore((s) => s.removeExercise);
  const duplicateExercise = useTrainingPlanStore((s) => s.duplicateExercise);
  const addSet = useTrainingPlanStore((s) => s.addSet);
  const removeSet = useTrainingPlanStore((s) => s.removeSet);
  const updateSet = useTrainingPlanStore((s) => s.updateSet);
  const updateSessionName = useTrainingPlanStore((s) => s.updateSessionName);
  const updateSessionNotes = useTrainingPlanStore((s) => s.updateSessionNotes);
  const updateExerciseNotes = useTrainingPlanStore((s) => s.updateExerciseNotes);
  const updateExerciseRestSeconds = useTrainingPlanStore((s) => s.updateExerciseRestSeconds);
  const revert = useTrainingPlanStore((s) => s.revert);
  const updateDayNote = useTrainingPlanStore((s) => s.updateDayNote);
  const setStartDate = useTrainingPlanStore((s) => s.setStartDate);
  const moveSessionToDay = useTrainingPlanStore((s) => s.moveSessionToDay);
  const moveSessionToWeek = useTrainingPlanStore((s) => s.moveSessionToWeek);
  const moveExerciseToSession = useTrainingPlanStore((s) => s.moveExerciseToSession);
  const moveExerciseToWeek = useTrainingPlanStore((s) => s.moveExerciseToWeek);
  const reorderExercises = useTrainingPlanStore((s) => s.reorderExercises);

  // ── Local UI state ──
  const [selectedDay, setSelectedDay] = useState(1);
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());
  const [addingSessionDay, setAddingSessionDay] = useState<number | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const dayHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Resolve client name ──
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
    return () => { cancelled = true; };
  }, [planId, setPlan]);

  // ── Unsaved changes warning ──
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Block in-app navigation when dirty ──
  useEffect(() => {
    if (!isDirty) return;
    const handler = () => {
      window.history.pushState(null, '', location.pathname + location.search);
      setPendingNav('__back__');
    };
    window.addEventListener('popstate', handler);
    window.history.pushState(null, '', location.pathname + location.search);
    return () => window.removeEventListener('popstate', handler);
  }, [isDirty, location.pathname, location.search]);

  useEffect(() => {
    if (!isDirty) return;
    const origPush = window.history.pushState.bind(window.history);
    const currentPath = location.pathname + location.search;
    window.history.pushState = function (...args: Parameters<typeof origPush>) {
      const url = typeof args[2] === 'string' ? args[2] : '';
      if (url && url !== currentPath && !url.startsWith(currentPath + '#')) {
        setPendingNav(url);
        return;
      }
      return origPush(...args);
    };
    return () => { window.history.pushState = origPush; };
  }, [isDirty, location.pathname, location.search]);

  const confirmLeave = () => {
    const target = pendingNav;
    setPendingNav(null);
    useTrainingPlanStore.setState({ isDirty: false });
    if (target === '__back__') {
      window.history.back();
    } else if (target) {
      navigate(target);
    }
  };

  // ── Toggle helpers ──
  const toggleSession = useCallback((sessionId: string) => {
    setCollapsedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }, []);


  // ── Handlers ──
  const handleSave = async () => {
    await save();
  };

  const handleReset = async () => {
    if (!planId) return;
    try {
      const data = await getTrainingPlan(planId);
      setPlan(data);
    } catch {
      showApiError(undefined, 'common.error');
    }
  };

  const handlePublish = async () => {
    if (!window.confirm(t('training.confirmPublish', { number: selectedWeek }))) return;
    await publishWeek(selectedWeek);
  };

  const handleAddSession = (dow: number) => {
    if (!newSessionName.trim()) return;
    addSession(selectedWeek, dow, newSessionName.trim());
    setNewSessionName('');
    setAddingSessionDay(null);
  };


  // ── Derived data ──
  const currentWeek = plan?.weeks.find((w) => w.weekNumber === selectedWeek) ?? plan?.weeks[0];
  const isWeekPublished = currentWeek?.status === 'Published';

  const daySessions = useMemo(
    () =>
      (currentWeek?.sessions ?? [])
        .filter((s) => s.dayOfWeek === selectedDay)
        .sort((a, b) => a.order - b.order),
    [currentWeek, selectedDay],
  );

  // Week tab data
  const weekTabs: WeekTabData[] = useMemo(() => {
    if (!plan) return [];
    return plan.weeks.map((w) => ({
      index: w.weekNumber,
      label: t('nutrition.weekLabel', { number: w.weekNumber }),
      isTemplate: w.status === 'Published',
    }));
  }, [plan, t]);

  // Day tab data
  const dayTabs = useMemo(() => {
    if (!currentWeek) return [];
    return DAY_KEYS.map((key, idx) => {
      const dayOfWeek = idx + 1;
      const sessions = (currentWeek.sessions ?? []).filter((s) => s.dayOfWeek === dayOfWeek);
      const exerciseCount = sessions.reduce((sum, s) => sum + s.exercises.length, 0);
      return {
        index: dayOfWeek,
        key,
        label: t(`nutrition.${key}`),
        badge: sessions.length > 0 ? `${sessions.length}t · ${exerciseCount}cv` : '—',
      };
    });
  }, [currentWeek, t]);

  // Open all sessions of the current day on first load / day change
  useEffect(() => {
    if (!plan) return;
    const week = plan.weeks.find((w) => w.weekNumber === selectedWeek);
    const sessions = (week?.sessions ?? []).filter((s) => s.dayOfWeek === selectedDay);
    // Don't collapse any sessions by default — remove from collapsed set
    setCollapsedSessions((prev) => {
      const next = new Set(prev);
      for (const s of sessions) {
        next.delete(s.sessionId);
      }
      return next;
    });
  }, [plan, selectedWeek, selectedDay]);

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
        icon="🏋️"
        title={t('sidebar.trainingPlan')}
        subtitle={`${clientName ?? '...'} · ${t('training.planSubtitle')}`}
        actions={
          <div className="flex items-center gap-1.5">
            {isDirty && (
              <span style={{ fontSize: 11, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--orange)' }} />
                {t('training.unsavedChanges')}
              </span>
            )}
            {isSaving && (
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t('training.saving')}</span>
            )}
            <Button variant="default" size="sm" onClick={() => setResetConfirmOpen(true)} disabled={!isDirty}>
              {t('training.discardChanges')}
            </Button>
            <Button variant="default" size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? t('training.saving') : t('training.save')}
            </Button>
            <Button variant="primary" size="sm" onClick={handlePublish} disabled={isWeekPublished || isDirty}>
              {isWeekPublished ? t('training.published') : t('training.publishWeek', { number: selectedWeek })}
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
      />

      {/* ── Two-column body ── */}
      <div className="flex-1 overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '1fr 256px' }}>
        {/* Left: Day tabs + Sessions */}
        <div className="flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--border)', minWidth: 0 }}>
          {/* Day tabs */}
          <div className="flex items-center border-b border-border shrink-0">
            {dayTabs.map((day) => (
              <button
                key={day.index}
                type="button"
                onClick={() => setSelectedDay(day.index)}
                onDragOver={(e) => {
                  const hasSession = e.dataTransfer.types.includes('application/session-json');
                  const hasExercise = e.dataTransfer.types.includes('application/exercise-json');
                  if (!hasSession && !hasExercise) return;
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
                  if (!e.dataTransfer.types.includes('application/session-json')) return;
                  e.preventDefault();
                  try {
                    const data = JSON.parse(e.dataTransfer.getData('application/session-json'));
                    if (data.type === 'session' && data.sessionId) {
                      const fromWeek = data.fromWeek ?? selectedWeek;
                      if (fromWeek !== selectedWeek) {
                        moveSessionToWeek(fromWeek, selectedWeek, data.sessionId, day.index, 999);
                      } else {
                        moveSessionToDay(selectedWeek, data.sessionId, day.index, 999);
                      }
                      setSelectedDay(day.index);
                    }
                  } catch { /* ignore */ }
                }}
                style={{
                  flex: 1, border: 'none', fontFamily: 'inherit',
                  borderBottom: day.index === selectedDay ? '2px solid var(--text)' : '2px solid transparent',
                  marginBottom: -1, padding: '7px 0', fontSize: 12,
                  color: day.index === selectedDay ? 'var(--text)' : 'var(--text3)',
                  fontWeight: day.index === selectedDay ? 500 : 400,
                  cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap',
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

          {/* Sessions list */}
          <div
            key={`${selectedWeek}-${selectedDay}`}
            className="tab-content-transition flex-1 overflow-y-auto"
            style={{ padding: '12px 20px' }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('application/session-json')) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes('application/session-json')) return;
              e.preventDefault();
              try {
                const data = JSON.parse(e.dataTransfer.getData('application/session-json'));
                if (data.type !== 'session' || !data.sessionId) return;
                const fromWeek = data.fromWeek ?? selectedWeek;

                // Find target position from mouse
                const container = e.currentTarget;
                const sessionEls = Array.from(container.querySelectorAll('[data-session-id]'));
                let targetIndex = sessionEls.length;
                for (let i = 0; i < sessionEls.length; i++) {
                  const rect = sessionEls[i].getBoundingClientRect();
                  if (e.clientY < rect.top + rect.height / 2) {
                    targetIndex = i;
                    break;
                  }
                }

                if (fromWeek !== selectedWeek) {
                  moveSessionToWeek(fromWeek, selectedWeek, data.sessionId, selectedDay, targetIndex);
                } else {
                  moveSessionToDay(selectedWeek, data.sessionId, selectedDay, targetIndex);
                }
              } catch { /* ignore */ }
            }}
          >
            {/* Day note */}
            <DayNoteInput
              note={currentWeek?.dayNotes?.[selectedDay]}
              onChange={(n) => updateDayNote(selectedWeek, selectedDay, n)}
              addLabel={t('training.addDayNote')}
              placeholder={t('training.dayNotePlaceholder')}
            />

            {daySessions.length === 0 && (
              <div className="py-12 text-center text-[13px] text-text3">
                {t('training.restDay')}
              </div>
            )}

            {daySessions.map((session) => {
              const isSessionOpen = !collapsedSessions.has(session.sessionId);

              return (
                <SessionDragWrapper
                  key={session.sessionId}
                  sessionId={session.sessionId}
                  selectedDay={selectedDay}
                  selectedWeek={selectedWeek}
                >
                  {/* Session header — MealBlock style */}
                  <div
                    className="group flex items-center gap-1.5 py-[5px] border-b border-border mb-[2px] cursor-grab active:cursor-grabbing select-none"
                    onClick={() => toggleSession(session.sessionId)}
                  >
                    <span
                      className={cn(
                        'text-[10px] text-text3 transition-transform duration-150 w-3 inline-flex items-center justify-center',
                        isSessionOpen && 'rotate-90',
                      )}
                    >
                      ▶
                    </span>
                    <span
                      className="text-[13px] font-semibold flex-1"
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'text', borderRadius: 'var(--radius)', padding: '1px 4px', transition: 'background 0.1s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                    >
                      <input
                        type="text"
                        value={session.name}
                        onChange={(e) => updateSessionName(selectedWeek, session.sessionId, e.target.value)}
                        className="w-full bg-transparent text-[13px] font-semibold text-text outline-none"
                        style={{ fontFamily: 'inherit' }}
                      />
                    </span>
                    <span className="text-xs text-text3 tabular-nums">
                      {t('training.exerciseSummary', { exercises: session.exercises.length, sets: session.exercises.reduce((s, e) => s + e.sets.length, 0) })}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const clone = {
                          ...session,
                          sessionId: crypto.randomUUID(),
                          name: `${session.name} (kopie)`,
                          order: daySessions.length + 1,
                          exercises: session.exercises.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s })) })),
                        };
                        const store = useTrainingPlanStore.getState();
                        if (!store.plan) return;
                        useTrainingPlanStore.setState({
                          plan: {
                            ...store.plan,
                            weeks: store.plan.weeks.map((w) =>
                              w.weekNumber === selectedWeek
                                ? { ...w, sessions: [...w.sessions, clone] }
                                : w,
                            ),
                          },
                          isDirty: true,
                        });
                      }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                        fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
                        transition: 'color 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
                      title={t('training.duplicateSession')}
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeSession(selectedWeek, session.sessionId); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                        fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
                        transition: 'color 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
                      title={t('training.removeSession')}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Session body — animated collapse */}
                  <div className="collapse-grid" data-open={isSessionOpen}>
                    <div className="collapse-content">
                      {/* Session note */}
                      <div style={{ padding: '4px 8px 6px' }}>
                        <input
                          type="text"
                          value={session.notes ?? ''}
                          onChange={(e) => updateSessionNotes(selectedWeek, session.sessionId, e.target.value)}
                          placeholder={t('training.sessionNotesPlaceholder')}
                          style={{
                            width: '100%', border: 'none', outline: 'none', background: 'transparent',
                            fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit', fontStyle: 'italic',
                            padding: '2px 4px', borderRadius: 'var(--radius)', transition: 'background 0.1s',
                          }}
                          onFocus={(e) => { e.target.style.background = 'var(--bg-hover)'; }}
                          onBlur={(e) => { e.target.style.background = 'transparent'; }}
                        />
                      </div>

                      {/* Column headers — grid like MealBlock */}
                      <div className="grid gap-1 px-2 py-1" style={{ gridTemplateColumns: '1fr minmax(80px, 1fr) 50px 68px 68px 84px 22px' }}>
                        <span className="text-[11px] text-text3 font-medium">{t('training.exerciseLabel')}</span>
                        <span className="text-[11px] text-text3 font-medium">{t('training.noteLabel')}</span>
                        <span className="text-[11px] text-text3 font-medium text-right">{t('training.setsLabel')}</span>
                        <span className="text-[11px] text-text3 font-medium text-right">{t('training.repsLabel')}</span>
                        <span className="text-[11px] text-text3 font-medium text-right">{t('training.weightLabel')}</span>
                        <span className="text-[11px] text-text3 font-medium text-right">{t('training.restSecondsLabel')}</span>
                        <span />
                      </div>

                      {/* Exercise rows — wrapped in drop zone like MealDropZone */}
                      <ExerciseDropZone
                        sessionId={session.sessionId}
                        exerciseIds={session.exercises.map((_, i) => String(i))}
                        selectedWeek={selectedWeek}
                        onReorder={(fromIdx, toIdx) => reorderExercises(selectedWeek, session.sessionId, fromIdx, toIdx)}
                        onCrossSessionMove={(fromSessionId, fromIdx, toIdx, fromWeek) => {
                          if (fromWeek !== selectedWeek) {
                            moveExerciseToWeek(fromWeek, selectedWeek, fromSessionId, session.sessionId, fromIdx, toIdx);
                          } else {
                            moveExerciseToSession(selectedWeek, fromSessionId, session.sessionId, fromIdx, toIdx);
                          }
                        }}
                      >
                      {session.exercises.map((ex, exIdx) => {
                        const firstSet = ex.sets[0];
                        return (
                          <div
                            key={`${session.sessionId}-${exIdx}`}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData('application/exercise-json', JSON.stringify({
                                type: 'exercise', sessionId: session.sessionId, exerciseIndex: exIdx,
                                fromWeek: selectedWeek,
                              }));
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            data-item-id={String(exIdx)}
                            className="grid gap-1 px-2 py-[5px] items-center group/row transition-colors hover:bg-bg-hover cursor-grab active:cursor-grabbing"
                            style={{ gridTemplateColumns: '1fr minmax(80px, 1fr) 50px 68px 68px 84px 22px' }}
                          >
                            {/* Exercise name */}
                            <span className="text-[13px] text-text truncate">{ex.exerciseName}</span>
                            {/* Note */}
                            <input
                              type="text"
                              value={ex.notes ?? ''}
                              onChange={(e) => updateExerciseNotes(selectedWeek, session.sessionId, exIdx, e.target.value)}
                              placeholder={t('training.notePlaceholder')}
                              style={{
                                width: '100%', border: 'none', outline: 'none', background: 'transparent',
                                fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit', fontStyle: 'italic',
                                padding: '1px 3px', borderRadius: 'var(--radius)', transition: 'background 0.1s',
                                minWidth: 0,
                              }}
                              onFocus={(e) => { e.target.style.background = 'var(--bg-hover)'; }}
                              onBlur={(e) => { e.target.style.background = 'transparent'; }}
                            />
                            {/* Sets count — editable */}
                            <input
                              type="number"
                              min={1}
                              value={ex.sets.length}
                              onChange={(e) => {
                                const target = Math.max(1, Number(e.target.value) || 1);
                                const current = ex.sets.length;
                                if (target > current) {
                                  for (let i = 0; i < target - current; i++) addSet(selectedWeek, session.sessionId, exIdx);
                                } else if (target < current) {
                                  for (let i = current - 1; i >= target; i--) removeSet(selectedWeek, session.sessionId, exIdx, i);
                                }
                              }}
                              style={{
                                border: 'none', outline: 'none', background: 'transparent',
                                fontSize: 12, color: 'var(--text)', fontFamily: 'inherit',
                                padding: '2px 6px', borderRadius: 'var(--radius)',
                                textAlign: 'right', transition: 'background 0.1s',
                              }}
                              onFocus={(e) => { e.target.style.background = 'var(--bg-active)'; }}
                              onBlur={(e) => { e.target.style.background = 'transparent'; }}
                            />
                            {/* Reps — edits first set, and all sets uniformly */}
                            <input
                              type="number"
                              placeholder="--"
                              value={firstSet?.reps ?? ''}
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : null;
                                for (let i = 0; i < ex.sets.length; i++) {
                                  updateSet(selectedWeek, session.sessionId, exIdx, i, { reps: val });
                                }
                              }}
                              style={{
                                border: 'none', outline: 'none', background: 'transparent',
                                fontSize: 12, color: 'var(--text)', fontFamily: 'inherit',
                                padding: '2px 6px', borderRadius: 'var(--radius)',
                                textAlign: 'right', transition: 'background 0.1s',
                              }}
                              onFocus={(e) => { e.target.style.background = 'var(--bg-active)'; }}
                              onBlur={(e) => { e.target.style.background = 'transparent'; }}
                            />
                            {/* Weight — edits all sets uniformly */}
                            <input
                              type="number"
                              placeholder="--"
                              value={firstSet?.weightKg ?? ''}
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : null;
                                for (let i = 0; i < ex.sets.length; i++) {
                                  updateSet(selectedWeek, session.sessionId, exIdx, i, { weightKg: val });
                                }
                              }}
                              style={{
                                border: 'none', outline: 'none', background: 'transparent',
                                fontSize: 12, color: 'var(--text)', fontFamily: 'inherit',
                                padding: '2px 6px', borderRadius: 'var(--radius)',
                                textAlign: 'right', transition: 'background 0.1s',
                              }}
                              onFocus={(e) => { e.target.style.background = 'var(--bg-active)'; }}
                              onBlur={(e) => { e.target.style.background = 'transparent'; }}
                            />
                            {/* Rest seconds */}
                            <input
                              type="number"
                              placeholder="--"
                              value={ex.restSeconds ?? ''}
                              onChange={(e) =>
                                updateExerciseRestSeconds(
                                  selectedWeek, session.sessionId, exIdx,
                                  e.target.value ? Number(e.target.value) : 0,
                                )
                              }
                              style={{
                                border: 'none', outline: 'none', background: 'transparent',
                                fontSize: 12, color: 'var(--text3)', fontFamily: 'inherit',
                                padding: '2px 6px', borderRadius: 'var(--radius)',
                                textAlign: 'right', transition: 'background 0.1s',
                              }}
                              onFocus={(e) => { e.target.style.background = 'var(--bg-active)'; }}
                              onBlur={(e) => { e.target.style.background = 'transparent'; }}
                            />
                            {/* Remove exercise */}
                            <button
                              onClick={() => removeExercise(selectedWeek, session.sessionId, exIdx)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
                                transition: 'color 0.1s', opacity: 0,
                              }}
                              className="group-hover/row:!opacity-100"
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                      </ExerciseDropZone>

                      {/* Add exercise — inline dropdown search */}
                      <ExerciseSearch
                        onSelect={(exercise) => {
                          addExercise(selectedWeek, session.sessionId, exercise);
                        }}
                      />
                    </div>
                  </div>
                </SessionDragWrapper>
              );
            })}

            {/* Add session */}
            {addingSessionDay === selectedDay ? (
              <div className="flex gap-2 mt-2">
                <input
                  autoFocus
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSession(selectedDay)}
                  placeholder={t('training.sessionNamePlaceholder')}
                  className="flex-1 rounded-md border border-border-md bg-bg px-3 py-2 text-[13px] text-text outline-none transition-colors duration-150 placeholder:text-text3 focus:border-border-hv"
                  style={{ fontFamily: 'inherit' }}
                />
                <Button size="sm" variant="primary" onClick={() => handleAddSession(selectedDay)}>
                  {t('training.addButton')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setAddingSessionDay(null); setNewSessionName(''); }}
                >
                  {t('training.cancelButton')}
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-3 py-2 mt-2 border border-dashed border-border rounded-md cursor-pointer text-text3 text-[13px] transition-colors hover:bg-bg-hover hover:text-text"
                onClick={() => setAddingSessionDay(selectedDay)}
              >
                <span>+</span>
                <span>{t('training.addSessionButton')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Training sidebar */}
        <div className="flex flex-col overflow-y-auto bg-bg2">
          {/* Start date picker */}
          <div className="p-3 border-b border-border">
            <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-1.5">
              {t('training.startDate')}
            </div>
            <input
              type="date"
              value={plan.startDate?.split('T')[0] ?? ''}
              onChange={(e) => setStartDate(e.target.value || null)}
              className="auth-input"
              style={{ fontSize: 13, padding: '7px 10px', cursor: 'pointer', width: '100%' }}
            />
          </div>

          <TrainingSidebar
            sessions={daySessions}
            planStatus={currentWeek?.status ?? 'Draft'}
            clientName={clientName}
          />
        </div>
      </div>

      {/* ── Leave Page Confirmation Dialog ── */}
      <Dialog
        open={!!pendingNav}
        onClose={() => setPendingNav(null)}
        title={t('training.leaveTitle')}
        maxWidth={400}
        footer={
          <>
            <Button onClick={() => setPendingNav(null)}>{t('training.stay')}</Button>
            <Button variant="danger" onClick={confirmLeave}>
              {t('training.leaveWithoutSaving')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {t('training.leaveMessage')}
        </p>
      </Dialog>

      {/* ── Reset Confirmation Dialog ── */}
      <Dialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title={t('training.discardTitle')}
        maxWidth={380}
        footer={
          <>
            <Button onClick={() => setResetConfirmOpen(false)}>{t('training.cancel')}</Button>
            <Button variant="danger" onClick={() => { setResetConfirmOpen(false); handleReset(); }}>
              {t('training.discardChanges')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {t('training.discardMessage')}
        </p>
      </Dialog>

    </div>
  );
}

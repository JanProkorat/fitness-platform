import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTrainingPlan, completeTrainingPlan } from '@/api/training-plans';
import { listSectionTemplates } from '@/api/sectionTemplates';
import type { SectionTemplateResponse } from '@/api/sectionTemplates';
import { PlanQuestionnairePanel } from '@/components/questionnaire/PlanQuestionnairePanel';
import { getExercise } from '@/api/exercises';
import type { MuscleGroup } from '@/api/exercise-types';
import { apiClient } from '@/api/client';
import { useTrainingPlanStore } from '@/stores/trainingPlan';
import { PageHeader } from '@/components/layout';
import { showApiError, showSuccess } from '@/lib/api-errors';
import { Button, Dialog } from '@/components/ui';
import { MondayDatePicker } from '@/components/ui/MondayDatePicker';
import { ExerciseSearch } from '@/components/training/ExerciseSearch';
import { WeekDayTabs } from '@/components/nutrition';
import type { WeekTabData } from '@/components/nutrition/WeekDayTabs';
import { TrainingSidebar } from '@/components/training/TrainingSidebar';
import { cn } from '@/lib/cn';
import { DayNoteInput } from '@/components/common/DayNoteInput';
import { CheckInBanner } from '@/components/weekly-checkin/CheckInBanner';
import { PlanPhotosTab } from '@/components/photos/PlanPhotosTab';
import { DAY_KEYS, MUSCLE_ICONS, MUSCLE_COLORS } from '@/constants/training';
import { SessionDragWrapper } from '@/components/training/SessionDragWrapper';
import { ExerciseDropZone } from '@/components/training/ExerciseDropZone';
import { WeekOverviewGrid } from '@/components/training/WeekOverviewGrid';
import { ExerciseCardHeader } from '@/components/training/ExerciseCardHeader';
import { SetRow } from '@/components/training/SetRow';
import { MovementTypePill } from '@/components/training/MovementTypePill';
import { SectionFormatBar } from '@/components/training/SectionFormatBar';
import { ExerciseFormatBar } from '@/components/training/ExerciseFormatBar';

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
  const updateExerciseMovementType = useTrainingPlanStore((s) => s.updateExerciseMovementType);
  const updateExerciseFormat = useTrainingPlanStore((s) => s.updateExerciseFormat);
  const updateSessionFormat = useTrainingPlanStore((s) => s.updateSessionFormat);
  // updateExerciseRestSeconds and revert available via useTrainingPlanStore when needed
  const updateDayNote = useTrainingPlanStore((s) => s.updateDayNote);
  const setStartDate = useTrainingPlanStore((s) => s.setStartDate);
  const moveSessionToDay = useTrainingPlanStore((s) => s.moveSessionToDay);
  const moveSessionToWeek = useTrainingPlanStore((s) => s.moveSessionToWeek);
  const moveExerciseToSession = useTrainingPlanStore((s) => s.moveExerciseToSession);
  const moveExerciseToWeek = useTrainingPlanStore((s) => s.moveExerciseToWeek);
  const reorderExercises = useTrainingPlanStore((s) => s.reorderExercises);

  // ── Local UI state ──
  const [pageTab, setPageTab] = useState<'sessions' | 'photos'>('sessions');
  const [selectedDay, setSelectedDay] = useState(1);
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());
  const [addingSessionDay, setAddingSessionDay] = useState<number | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [templateConfirmTarget, setTemplateConfirmTarget] = useState<{
    sessionId: string;
    template: SectionTemplateResponse;
  } | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const dayHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [weekViewExpanded, setWeekViewExpanded] = useState(false);

  // ── Resolve client name ──
  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => apiClient.getClientsEndpoint(1, 200),
    enabled: !!plan?.clientId,
  });

  const clientEntry = useMemo(() => {
    if (!plan?.clientId || !clientsData?.clients) return null;
    return clientsData.clients.find((c) => c.publicId === plan.clientId) ?? null;
  }, [plan?.clientId, clientsData]);

  const clientName = useMemo(() => {
    if (!clientEntry) return null;
    return `${clientEntry.firstName ?? ''} ${clientEntry.lastName ?? ''}`.trim();
  }, [clientEntry]);

  // ── Fetch muscle groups for exercises ──
  const allExerciseIds = useMemo(() => {
    if (!plan) return [];
    const ids = new Set<string>();
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const e of s.exercises) {
          ids.add(e.exerciseExternalId);
        }
      }
    }
    return [...ids];
  }, [plan]);

  const { data: exerciseDetailsData } = useQuery({
    queryKey: ['exercise-details-plan', allExerciseIds],
    queryFn: async () => {
      const results = await Promise.allSettled(allExerciseIds.map((id) => getExercise(id)));
      const muscleMap = new Map<string, MuscleGroup[]>();
      const fullMap = new Map<string, { muscleGroups: MuscleGroup[]; difficulty: string }>();
      for (const r of results) {
        if (r.status === 'fulfilled') {
          muscleMap.set(r.value.exerciseId, r.value.muscleGroups);
          fullMap.set(r.value.exerciseId, { muscleGroups: r.value.muscleGroups, difficulty: r.value.difficulty });
        }
      }
      return { muscleMap, fullMap };
    },
    enabled: allExerciseIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const exerciseDetailsMap = exerciseDetailsData?.muscleMap;
  const exerciseFullMap = exerciseDetailsData?.fullMap;

  // ── Load section templates for the apply-template affordance ──
  const { data: templatesData } = useQuery({
    queryKey: ['section-templates-all'],
    queryFn: () => listSectionTemplates({ page: 1, pageSize: 200 }),
    staleTime: 60_000,
  });
  const sectionTemplates = templatesData?.templates ?? [];

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
  const toggleExercise = useCallback((key: string) => {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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
    } catch (err) {
      showApiError(err, 'common.error');
    }
  };

  const handlePublish = async () => {
    if (!window.confirm(t('training.confirmPublish', { number: selectedWeek }))) return;
    await publishWeek(selectedWeek);
  };

  const handleComplete = async () => {
    if (!plan || !planId) return;
    setIsCompleting(true);
    try {
      const updated = await completeTrainingPlan(planId, plan.version);
      setPlan(updated);
      setCompleteDialogOpen(false);
      showSuccess(t('training.planCompleted'));
    } catch (err) {
      showApiError(err, 'common.error');
    } finally {
      setIsCompleting(false);
    }
  };

  // Apply-template client-side splice: replaces exercises + format of the target session.
  const applyTemplateToSession = (sessionId: string, template: SectionTemplateResponse) => {
    const store = useTrainingPlanStore.getState();
    if (!store.plan) return;
    useTrainingPlanStore.setState({
      plan: {
        ...store.plan,
        weeks: store.plan.weeks.map((w) =>
          w.weekNumber !== selectedWeek
            ? w
            : {
                ...w,
                sessions: w.sessions.map((s) =>
                  s.sessionId !== sessionId
                    ? s
                    : {
                        ...s,
                        format: template.defaultFormat ?? 'Standard',
                        formatConfig: template.defaultFormatConfig ?? null,
                        exercises: template.defaultExercises.map((ex) => ({ ...ex })),
                      },
                ),
              },
        ),
      },
      isDirty: true,
    });
    setTemplateConfirmTarget(null);
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

  // Open all sessions but collapse all exercises on day/week change or initial load
  const [planLoaded, setPlanLoaded] = useState(false);
  useEffect(() => {
    if (plan && !planLoaded) setPlanLoaded(true);
  }, [plan, planLoaded]);

  useEffect(() => {
    if (!plan) return;
    const week = plan.weeks.find((w) => w.weekNumber === selectedWeek);
    const sessions = (week?.sessions ?? []).filter((s) => s.dayOfWeek === selectedDay);
    setCollapsedSessions((prev) => {
      const next = new Set(prev);
      for (const s of sessions) {
        next.delete(s.sessionId);
      }
      return next;
    });
    const exKeys = new Set<string>();
    for (const s of sessions) {
      for (let i = 0; i < s.exercises.length; i++) {
        exKeys.add(`${s.sessionId}-${i}`);
      }
    }
    setCollapsedExercises(exKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, selectedDay, planLoaded]);

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
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? t('training.saving') : t('training.save')}
            </Button>
            {plan?.status === 'Active' && (
              <Button variant="brand" size="sm" onClick={() => setCompleteDialogOpen(true)} disabled={isDirty}>
                {t('training.completePlan')}
              </Button>
            )}
          </div>
        }
      />
      </div>

      {/* ── Weekly check-in banner ── */}
      {plan.clientId && (
        <CheckInBanner clientUserId={plan.clientId} profession="Training" />
      )}

      {/* ── Page-level tabs: Sessions / Photos ── */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-border bg-bg">
        <button
          type="button"
          onClick={() => setPageTab('sessions')}
          className={cn(
            'px-3 py-1 rounded-full text-[12px] font-medium transition-colors border',
            pageTab === 'sessions'
              ? 'bg-accent text-bg border-accent'
              : 'bg-bg2 text-text3 border-border hover:bg-bg3 hover:text-text2',
          )}
        >
          {t('sidebar.trainingPlan')}
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
          <span className="text-[12px] font-medium">{t('training.startDate')}</span>
          <MondayDatePicker
            value={plan.startDate?.split('T')[0] ?? null}
            onChange={(val) => setStartDate(val)}
            placeholder="—"
            className="rounded-md border border-border bg-bg px-2.5 py-1 text-[12px] text-text outline-none transition-colors hover:border-border-md focus:border-border-hv"
            style={{ width: 120 }}
          />
          {pageTab === 'sessions' && (
            <Button variant="default" size="sm" onClick={addWeek} title={t('training.addWeek')} className="ml-1">
              {t('training.addWeek')}
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
            clientName={clientName ?? undefined}
            linkId={clientEntry?.linkId}
          />
        </div>
      )}

      {/* ── Sessions tab content ── */}
      {pageTab === 'sessions' && <>
      <WeekDayTabs
        weeks={weekTabs}
        days={[]}
        selectedWeek={selectedWeek}
        selectedDay={selectedDay}
        onWeekChange={setSelectedWeek}
        onDayChange={setSelectedDay}
        onRemoveWeek={removeWeek}
      />

      {/* ── Two-column body ── */}
      <div className="flex-1 overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '1fr 256px' }}>
        {/* Left: Day tabs + Sessions */}
        <div className="flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--border)', minWidth: 0 }}>

      {/* ── Day bar with expand toggle ── */}
      <div className="relative shrink-0">
      <div className="flex items-center border-b border-border">
        <div className="flex items-center flex-1">
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
                borderBottom: !weekViewExpanded && day.index === selectedDay ? '2px solid var(--text)' : '2px solid transparent',
                marginBottom: -1, padding: '7px 0', fontSize: 12,
                color: !weekViewExpanded && day.index === selectedDay ? 'var(--text)' : 'var(--text3)',
                fontWeight: !weekViewExpanded && day.index === selectedDay ? 500 : 400,
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
        <button
          type="button"
          onClick={() => setWeekViewExpanded((v) => !v)}
          className="shrink-0 px-3 py-1.5 text-[11px] text-text3 transition-colors hover:text-text"
          title={weekViewExpanded ? t('training.collapseWeekView') : t('training.expandWeekView')}
        >
          {weekViewExpanded ? '⊟' : '⊞'}
        </button>
      </div>

      {/* ── Expandable week grid overview (dropdown overlay) ── */}
      <WeekOverviewGrid
        weekViewExpanded={weekViewExpanded}
        currentWeek={currentWeek}
        selectedDay={selectedDay}
        exerciseDetailsMap={exerciseDetailsMap}
      />
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
                  <div className="rounded-md border border-border bg-bg transition-all duration-100 hover:border-border-md">
                  {/* Session header */}
                  <div
                    className={cn(
                      'group flex items-center gap-1.5 px-3 py-2 cursor-grab active:cursor-grabbing select-none transition-colors hover:bg-bg3',
                      isSessionOpen && 'border-b border-border',
                    )}
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
                      {/* Section format bar */}
                      <SectionFormatBar
                        format={session.format}
                        formatConfig={session.formatConfig}
                        onFormatChange={(fmt, cfg) =>
                          updateSessionFormat(selectedWeek, session.sessionId, fmt, cfg)
                        }
                      />

                      {/* Apply-template affordance */}
                      {sectionTemplates.length > 0 && (
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 border-b border-border"
                          style={{ background: 'var(--bg2)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500, userSelect: 'none' }}>
                            {t('training.section.applyTemplate')}
                          </span>
                          <div className="relative inline-flex shrink-0">
                            <select
                              value=""
                              onChange={(e) => {
                                const tpl = sectionTemplates.find(
                                  (x) => x.templateId === e.target.value,
                                );
                                if (!tpl) return;
                                if (session.exercises.length > 0) {
                                  setTemplateConfirmTarget({ sessionId: session.sessionId, template: tpl });
                                } else {
                                  applyTemplateToSession(session.sessionId, tpl);
                                }
                              }}
                              style={{
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                background: 'var(--bg)',
                                color: 'var(--text2)',
                                fontSize: 11,
                                fontFamily: 'inherit',
                                fontWeight: 500,
                                padding: '2px 20px 2px 8px',
                                cursor: 'pointer',
                                outline: 'none',
                                lineHeight: '18px',
                              }}
                            >
                              <option value="">— {t('training.template.selectPrompt')} —</option>
                              {sectionTemplates.map((tpl) => (
                                <option key={tpl.templateId} value={tpl.templateId}>
                                  {tpl.name}
                                </option>
                              ))}
                            </select>
                            <span
                              style={{
                                position: 'absolute',
                                right: 5,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: 8,
                                color: 'var(--text4)',
                                pointerEvents: 'none',
                              }}
                            >
                              ▾
                            </span>
                          </div>
                        </div>
                      )}

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

                      {/* Exercise cards — collapsible list */}
                      <div className="px-2 pt-1.5">
                      <ExerciseDropZone
                        sessionId={session.sessionId}
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
                        const exKey = `${session.sessionId}-${exIdx}`;
                        const isExOpen = !collapsedExercises.has(exKey);
                        const setsCount = ex.sets.length;
                        const repsValues = ex.sets.map((s) => s.reps).filter((r): r is number => r != null);
                        const weightValues = ex.sets.map((s) => s.weightKg).filter((w): w is number => w != null);
                        const repsMin = repsValues.length > 0 ? Math.min(...repsValues) : null;
                        const repsMax = repsValues.length > 0 ? Math.max(...repsValues) : null;
                        const weightMin = weightValues.length > 0 ? Math.min(...weightValues) : null;
                        const weightMax = weightValues.length > 0 ? Math.max(...weightValues) : null;
                        const repsStr = repsMin == null ? '–' : repsMin === repsMax ? `${repsMin}` : `${repsMin}-${repsMax}`;
                        const weightStr = weightMin == null ? '–' : weightMin === weightMax ? `${weightMin}` : `${weightMin}-${weightMax}`;
                        const totalVolume = ex.sets.reduce((sum, s) => sum + ((s.reps ?? 0) * (s.weightKg ?? 0)), 0);

                        const muscleGroups = exerciseDetailsMap?.get(ex.exerciseExternalId) ?? [];
                        const primaryMuscle = muscleGroups[0] as string | undefined;
                        const muscleColor = primaryMuscle ? MUSCLE_COLORS[primaryMuscle] ?? 'var(--accent)' : 'var(--accent)';
                        const muscleIcon = primaryMuscle ? MUSCLE_ICONS[primaryMuscle] ?? '🏋️' : '🏋️';
                        const difficulty = exerciseFullMap?.get(ex.exerciseExternalId)?.difficulty;

                        return (
                          <div
                            key={exKey}
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
                            className="rounded-md border border-border bg-bg mb-1.5 overflow-hidden transition-all duration-100 hover:border-border-md cursor-grab active:cursor-grabbing"
                          >
                            {/* Exercise card header */}
                            <ExerciseCardHeader
                              exercise={ex}
                              muscleGroups={muscleGroups}
                              repsStr={repsStr}
                              weightStr={weightStr}
                              setsCount={setsCount}
                              totalVolume={totalVolume}
                              isOpen={isExOpen}
                              onToggle={() => toggleExercise(exKey)}
                              onDuplicate={() => duplicateExercise(selectedWeek, session.sessionId, exIdx)}
                              onRemove={() => removeExercise(selectedWeek, session.sessionId, exIdx)}
                              difficulty={difficulty}
                              muscleColor={muscleColor}
                              muscleIcon={muscleIcon}
                            />

                            {/* Exercise card body — sets table */}
                            <div className="collapse-grid" data-open={isExOpen}>
                              <div className="collapse-content">
                                {/* Per-exercise format override */}
                                <ExerciseFormatBar
                                  format={ex.format}
                                  formatConfig={ex.formatConfig}
                                  sessionFormat={session.format}
                                  onFormatChange={(fmt, cfg) =>
                                    updateExerciseFormat(selectedWeek, session.sessionId, exIdx, fmt, cfg)
                                  }
                                />

                                <div className="px-3 py-2">
                                  {/* MovementType picker + sets table header */}
                                  <div className="flex items-center justify-between mb-1">
                                    <MovementTypePill
                                      value={ex.movementType}
                                      onChange={(mt) =>
                                        updateExerciseMovementType(selectedWeek, session.sessionId, exIdx, mt)
                                      }
                                    />
                                    {/* Column header labels — adapt to movementType */}
                                    <div className="flex items-center gap-2 text-[10px] font-medium text-text3 uppercase">
                                      {ex.movementType === 'Reps' && (
                                        <>
                                          <span className="w-[68px] text-right">{t('training.weightLabel')}</span>
                                          <span className="w-[68px] text-right">{t('training.repsLabel')}</span>
                                          <span className="w-[90px] text-right">{t('training.restSecondsLabel')}</span>
                                        </>
                                      )}
                                      {ex.movementType === 'Time' && (
                                        <>
                                          <span className="w-[80px] text-right">{t('training.wod.durationLabel')}</span>
                                          <span className="w-[90px] text-right">{t('training.restSecondsLabel')}</span>
                                        </>
                                      )}
                                      {ex.movementType === 'Distance' && (
                                        <>
                                          <span className="w-[80px] text-right">{t('training.wod.distanceLabel')}</span>
                                          <span className="w-[80px] text-right">{t('training.wod.durationLabel')}</span>
                                          <span className="w-[90px] text-right">{t('training.restSecondsLabel')}</span>
                                        </>
                                      )}
                                      {ex.movementType === 'RepsForTime' && (
                                        <>
                                          <span className="w-[68px] text-right">{t('training.repsLabel')}</span>
                                          <span className="w-[90px] text-right">{t('training.restSecondsLabel')}</span>
                                        </>
                                      )}
                                      <span className="w-5" />
                                    </div>
                                  </div>

                                  {/* Set rows — extracted to SetRow component */}
                                  {ex.sets.map((s, sIdx) => (
                                    <SetRow
                                      key={sIdx}
                                      set={s}
                                      movementType={ex.movementType}
                                      onUpdate={(updates) =>
                                        updateSet(selectedWeek, session.sessionId, exIdx, sIdx, updates)
                                      }
                                      onRemove={() =>
                                        removeSet(selectedWeek, session.sessionId, exIdx, sIdx)
                                      }
                                    />
                                  ))}

                                  {/* Add set */}
                                  <button
                                    type="button"
                                    onClick={() => addSet(selectedWeek, session.sessionId, exIdx)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontSize: 11, color: 'var(--text4)', fontFamily: 'inherit', transition: 'color 0.1s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
                                  >
                                    + {t('training.addSet')}
                                  </button>

                                  {/* Exercise note */}
                                  <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                                    <input
                                      type="text"
                                      value={ex.notes ?? ''}
                                      onChange={(e) => updateExerciseNotes(selectedWeek, session.sessionId, exIdx, e.target.value)}
                                      placeholder={t('training.notePlaceholder')}
                                      style={{
                                        width: '100%', border: 'none', outline: 'none', background: 'transparent',
                                        fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit', fontStyle: 'italic',
                                        padding: '2px 4px', borderRadius: 'var(--radius)', transition: 'background 0.1s',
                                      }}
                                      onFocus={(e) => { e.target.style.background = 'var(--bg-hover)'; }}
                                      onBlur={(e) => { e.target.style.background = 'transparent'; }}
                                    />
                                  </div>

                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </ExerciseDropZone>
                      </div>

                      {/* Add exercise — inline dropdown search */}
                      <ExerciseSearch
                        onSelect={(exercise) => {
                          addExercise(selectedWeek, session.sessionId, exercise);
                        }}
                      />
                    </div>
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
        <div className="flex flex-col overflow-y-auto bg-bg2" style={{ scrollbarGutter: 'stable' }}>
          <TrainingSidebar sessions={daySessions} />

          {/* Week-scoped action — publish */}
          <div className="p-3 border-t border-border">
            <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-2">
              {t('nutrition.weekLabel', { number: selectedWeek })}
            </div>
            <Button
              variant="brand"
              onClick={handlePublish}
              disabled={isWeekPublished || isDirty || plan?.status === 'Completed'}
              className="flex w-full justify-center"
            >
              {isWeekPublished ? t('training.published') : t('common.publish')}
            </Button>
          </div>

          <PlanQuestionnairePanel
            clientId={plan.clientId}
            questionnaireResponseId={plan.questionnaireResponseId}
            planStatus={plan.status}
            ns="training"
          />
        </div>
      </div>
      </>}

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

      {/* ── Complete Plan Confirmation Dialog ── */}
      <Dialog
        open={completeDialogOpen}
        onClose={() => setCompleteDialogOpen(false)}
        title={t('training.completePlan')}
        maxWidth={420}
        footer={
          <>
            <Button onClick={() => setCompleteDialogOpen(false)}>{t('common.cancel')}</Button>
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="px-5 py-2 rounded-md text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {isCompleting ? '...' : t('training.completePlan')}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {t('training.confirmComplete')}
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

      {/* ── Apply Template Confirm Dialog ── */}
      <Dialog
        open={!!templateConfirmTarget}
        onClose={() => setTemplateConfirmTarget(null)}
        title={t('training.section.applyTemplate')}
        maxWidth={400}
        footer={
          <>
            <Button onClick={() => setTemplateConfirmTarget(null)}>{t('training.cancel')}</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (templateConfirmTarget) {
                  applyTemplateToSession(
                    templateConfirmTarget.sessionId,
                    templateConfirmTarget.template,
                  );
                }
              }}
            >
              {t('training.template.applyConfirm')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {t('training.template.applyConfirmMessage', {
            name: templateConfirmTarget?.template.name ?? '',
          })}
        </p>
      </Dialog>

    </div>
  );
}

import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTrainingPlan, completeTrainingPlan } from '@/api/training-plans';
import { listSectionTemplates, createSectionTemplate } from '@/api/sectionTemplates';
import type { SectionTemplateResponse } from '@/api/sectionTemplates';
import type { WorkoutFormat, MovementType, SetType } from '@/api/training-plan-types';
import type { WorkoutFormat as GenWorkoutFormat, MovementType as GenMovementType, SetType as GenSetType, WodConfig as GenWodConfig } from '@/api/generated';
import { PlanQuestionnairePanel } from '@/components/questionnaire/PlanQuestionnairePanel';
import { getExercise } from '@/api/exercises';
import type { MuscleGroup } from '@/api/exercise-types';
import { apiClient } from '@/api/client';
import { useTrainingPlanStore } from '@/stores/trainingPlan';
import { PageHeader } from '@/components/layout';
import { showApiError, showSuccess } from '@/lib/api-errors';
import { Button, Dialog } from '@/components/ui';
import { MondayDatePicker } from '@/components/ui/MondayDatePicker';
import { WeekDayTabs } from '@/components/nutrition';
import type { WeekTabData } from '@/components/nutrition/WeekDayTabs';
import { TrainingSidebar } from '@/components/training/TrainingSidebar';
import { cn } from '@/lib/cn';
import { DayNoteInput } from '@/components/common/DayNoteInput';
import { CheckInBanner } from '@/components/weekly-checkin/CheckInBanner';
import { PlanPhotosTab } from '@/components/photos/PlanPhotosTab';
import { DAY_KEYS } from '@/constants/training';
import { SessionDragWrapper } from '@/components/training/SessionDragWrapper';
import { WeekOverviewGrid } from '@/components/training/WeekOverviewGrid';
import { SectionCard } from '@/components/training/SectionCard';

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
  const addSection = useTrainingPlanStore((s) => s.addSection);
  const removeSection = useTrainingPlanStore((s) => s.removeSection);
  const updateSection = useTrainingPlanStore((s) => s.updateSection);
  const addSectionFromTemplate = useTrainingPlanStore((s) => s.addSectionFromTemplate);
  const addExerciseToSection = useTrainingPlanStore((s) => s.addExerciseToSection);
  const removeExerciseFromSection = useTrainingPlanStore((s) => s.removeExerciseFromSection);
  const duplicateExerciseInSection = useTrainingPlanStore((s) => s.duplicateExerciseInSection);
  const addSet = useTrainingPlanStore((s) => s.addSet);
  const removeSet = useTrainingPlanStore((s) => s.removeSet);
  const updateSet = useTrainingPlanStore((s) => s.updateSet);
  const updateSessionName = useTrainingPlanStore((s) => s.updateSessionName);
  const updateSessionNotes = useTrainingPlanStore((s) => s.updateSessionNotes);
  const updateExerciseNotes = useTrainingPlanStore((s) => s.updateExerciseNotes);
  const updateExerciseMovementType = useTrainingPlanStore((s) => s.updateExerciseMovementType);
  const updateExerciseFormat = useTrainingPlanStore((s) => s.updateExerciseFormat);
  // updateExerciseRestSeconds and revert available via useTrainingPlanStore when needed
  const updateDayNote = useTrainingPlanStore((s) => s.updateDayNote);
  const setStartDate = useTrainingPlanStore((s) => s.setStartDate);
  const moveSessionToDay = useTrainingPlanStore((s) => s.moveSessionToDay);
  const moveSessionToWeek = useTrainingPlanStore((s) => s.moveSessionToWeek);

  // ── Local UI state ──
  const [pageTab, setPageTab] = useState<'sessions' | 'photos'>('sessions');
  const [selectedDay, setSelectedDay] = useState(1);
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());
  const [addingSessionDay, setAddingSessionDay] = useState<number | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [templateConfirmTarget, setTemplateConfirmTarget] = useState<{
    sessionId: string;
    template: SectionTemplateResponse;
  } | null>(null);
  const [saveAsTemplateTarget, setSaveAsTemplateTarget] = useState<{
    sessionId: string;
    sectionId: string;
    sectionName: string;
  } | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
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
    queryKey: ['section-templates'],
    queryFn: () => listSectionTemplates(),
    staleTime: 60_000,
  });
  const sectionTemplates = templatesData ?? [];

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
                        // Generated SectionTemplateResponse.defaultFormat is string | undefined; safe cast
                        // because the backend only emits WorkoutFormat enum values.
                        format: (template.defaultFormat ?? 'Standard') as WorkoutFormat,
                        formatConfig: template.defaultFormatConfig ?? null,
                        // Map generated SessionExercise (all fields optional per NSwag) to the local
                        // SessionExercise shape (required fields). Backend guarantees well-formed data
                        // for stored template exercises, so fallbacks here are defensive only.
                        exercises: (template.defaultExercises ?? []).map((ex) => ({
                          exerciseExternalId: ex.exerciseExternalId ?? '',
                          exerciseName: ex.exerciseName ?? '',
                          order: ex.order ?? 1,
                          notes: ex.notes ?? null,
                          restSeconds: ex.restSeconds ?? null,
                          movementType: (ex.movementType ?? 'Reps') as MovementType,
                          format: (ex.format ?? null) as WorkoutFormat | null,
                          formatConfig: ex.formatConfig ?? null,
                          sets: (ex.sets ?? []).map((s) => ({
                            setNumber: s.setNumber ?? 1,
                            type: (s.type ?? 'Normal') as SetType,
                            reps: s.reps ?? null,
                            weightKg: s.weightKg ?? null,
                            durationSeconds: s.durationSeconds ?? null,
                            rpe: s.rpe ?? null,
                            distanceMeters: s.distanceMeters ?? null,
                            restSeconds: s.restSeconds ?? null,
                          })),
                        })),
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

  const handleConfirmSaveAsTemplate = async () => {
    if (!saveAsTemplateTarget || !plan) return;
    const session = plan.weeks
      .find((w) => w.weekNumber === selectedWeek)
      ?.sessions.find((s) => s.sessionId === saveAsTemplateTarget.sessionId);
    const section = session?.sections.find((sec) => sec.sectionId === saveAsTemplateTarget.sectionId);
    if (!section) return;
    setIsSavingTemplate(true);
    try {
      // The local training-plan-types use null for absent values; the generated
      // CreateSectionTemplateRequest uses undefined. Bridge the gap with null-to-undefined coercion.
      const toGenWodConfig = (cfg: { timeCapSeconds?: number | null; intervalSeconds?: number | null; totalRounds?: number | null; workSeconds?: number | null; restSeconds?: number | null } | null | undefined): GenWodConfig | undefined => {
        if (!cfg) return undefined;
        return {
          timeCapSeconds: cfg.timeCapSeconds ?? undefined,
          intervalSeconds: cfg.intervalSeconds ?? undefined,
          totalRounds: cfg.totalRounds ?? undefined,
          workSeconds: cfg.workSeconds ?? undefined,
          restSeconds: cfg.restSeconds ?? undefined,
        };
      };
      await createSectionTemplate({
        name: section.name || t('training.section.defaultName'),
        defaultFormat: (section.format === 'Standard' ? undefined : section.format) as GenWorkoutFormat | undefined,
        defaultFormatConfig: toGenWodConfig(section.formatConfig),
        defaultExercises: section.exercises.map((ex) => ({
          exerciseExternalId: ex.exerciseExternalId,
          exerciseName: ex.exerciseName,
          order: ex.order,
          notes: ex.notes ?? undefined,
          restSeconds: ex.restSeconds ?? undefined,
          movementType: ex.movementType as GenMovementType,
          format: (ex.format ?? undefined) as GenWorkoutFormat | undefined,
          formatConfig: toGenWodConfig(ex.formatConfig),
          sets: ex.sets.map((s) => ({
            setNumber: s.setNumber,
            type: s.type as GenSetType,
            reps: s.reps ?? undefined,
            weightKg: s.weightKg ?? undefined,
            durationSeconds: s.durationSeconds ?? undefined,
            rpe: s.rpe ?? undefined,
            distanceMeters: s.distanceMeters ?? undefined,
            restSeconds: s.restSeconds ?? undefined,
          })),
        })),
      });
      showSuccess(t('training.section.savedAsTemplate'));
      setSaveAsTemplateTarget(null);
    } catch (err) {
      showApiError(err, 'common.error');
    } finally {
      setIsSavingTemplate(false);
    }
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
    // Exercise collapse state is managed inside SectionCard — no page-level action needed.
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

                      {/* Section cards */}
                      <div className="px-2 pt-1">
                        {session.sections.map((section) => (
                          <SectionCard
                            key={section.sectionId}
                            section={section}
                            sessionFormat={session.format}
                            exerciseDetailsMap={exerciseDetailsMap}
                            exerciseFullMap={exerciseFullMap}
                            onUpdate={(patch) =>
                              updateSection(selectedWeek, session.sessionId, section.sectionId, patch)
                            }
                            onRemove={() =>
                              removeSection(selectedWeek, session.sessionId, section.sectionId)
                            }
                            onAddExercise={(exercise) =>
                              addExerciseToSection(selectedWeek, session.sessionId, section.sectionId, exercise)
                            }
                            onRemoveExercise={(exIdx) =>
                              removeExerciseFromSection(selectedWeek, session.sessionId, section.sectionId, exIdx)
                            }
                            onDuplicateExercise={(exIdx) =>
                              duplicateExerciseInSection(selectedWeek, session.sessionId, section.sectionId, exIdx)
                            }
                            onAddSet={(exIdx) =>
                              addSet(selectedWeek, session.sessionId, section.sectionId, exIdx)
                            }
                            onRemoveSet={(exIdx, sIdx) =>
                              removeSet(selectedWeek, session.sessionId, section.sectionId, exIdx, sIdx)
                            }
                            onUpdateSet={(exIdx, sIdx, updates) =>
                              updateSet(selectedWeek, session.sessionId, section.sectionId, exIdx, sIdx, updates)
                            }
                            onUpdateExerciseNotes={(exIdx, notes) =>
                              updateExerciseNotes(selectedWeek, session.sessionId, section.sectionId, exIdx, notes)
                            }
                            onUpdateExerciseMovementType={(exIdx, mt) =>
                              updateExerciseMovementType(selectedWeek, session.sessionId, section.sectionId, exIdx, mt)
                            }
                            onUpdateExerciseFormat={(exIdx, fmt, cfg) =>
                              updateExerciseFormat(selectedWeek, session.sessionId, section.sectionId, exIdx, fmt, cfg)
                            }
                            onSaveAsTemplate={() =>
                              setSaveAsTemplateTarget({
                                sessionId: session.sessionId,
                                sectionId: section.sectionId,
                                sectionName: section.name || t('training.section.defaultName'),
                              })
                            }
                          />
                        ))}
                      </div>

                      {/* Add section affordances */}
                      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
                        <button
                          type="button"
                          onClick={() => addSection(selectedWeek, session.sessionId, 'Standard')}
                          className="flex items-center gap-1 text-[11px] text-text3 transition-colors hover:text-text"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          <span>+</span>
                          <span>{t('training.section.create')}</span>
                        </button>
                        {sectionTemplates.length > 0 && (
                          <>
                            <span className="text-text4 text-[10px]">·</span>
                            <span style={{ fontSize: 10, color: 'var(--text4)', userSelect: 'none' }}>
                              {t('training.section.addFromTemplate')}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {sectionTemplates.map((tpl) => (
                                <button
                                  key={tpl.templateId}
                                  type="button"
                                  onClick={() => addSectionFromTemplate(selectedWeek, session.sessionId, tpl)}
                                  className="px-2 py-0.5 rounded-full text-[10px] border border-border text-text3 transition-colors hover:bg-accent-bg hover:text-accent hover:border-accent"
                                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                                >
                                  {tpl.name ?? ''}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
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

      {/* ── Save Section as Template Confirm Dialog ── */}
      <Dialog
        open={!!saveAsTemplateTarget}
        onClose={() => setSaveAsTemplateTarget(null)}
        title={t('training.section.saveAsTemplate')}
        maxWidth={400}
        footer={
          <>
            <Button onClick={() => setSaveAsTemplateTarget(null)}>{t('training.cancel')}</Button>
            <Button
              variant="primary"
              disabled={isSavingTemplate}
              onClick={handleConfirmSaveAsTemplate}
            >
              {isSavingTemplate ? t('common.saving') : t('training.section.saveAsTemplate')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {t('training.section.saveAsTemplateConfirm', {
            name: saveAsTemplateTarget?.sectionName ?? '',
          })}
        </p>
      </Dialog>

    </div>
  );
}

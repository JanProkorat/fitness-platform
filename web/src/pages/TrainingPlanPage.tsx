import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTrainingPlan, completeTrainingPlan, finishSession, unlockTrainingSession, relockTrainingSession } from '@/api/training-plans';
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
import { showApiError, showSuccess, showError } from '@/lib/api-errors';
import { Button, Dialog } from '@/components/ui';
import { MondayDatePicker } from '@/components/ui/MondayDatePicker';
import { WeekDayTabs } from '@/components/nutrition';
import type { WeekTabData } from '@/components/nutrition/WeekDayTabs';
import { TrainingSidebar } from '@/components/training/TrainingSidebar';
import { SectionTemplateSearch } from '@/components/training/SectionTemplateSearch';
import { cn } from '@/lib/cn';
import { isDayInPast, isWeekFinished, todayWeekdayInPlan, weekStartDate, sessionScheduledDateUtc } from '@/lib/training-plan-dates';
import { estimatedSectionDurationSeconds, formatDurationCompact } from '@/lib/training-plan-format';
import { computePlanLocks, exerciseLockKey } from '@/lib/training-plan-locks';
import { deriveSessionCompletionState } from '@/lib/completionState';
import { CompletionBadge } from '@/components/common/CompletionBadge';
import { DayNoteInput } from '@/components/common/DayNoteInput';
import { CheckInBanner } from '@/components/weekly-checkin/CheckInBanner';
import { PlanPhotosTab } from '@/components/photos/PlanPhotosTab';
import { DAY_KEYS } from '@/constants/training';
import { SessionDragWrapper } from '@/components/training/SessionDragWrapper';
import { SectionDragWrapper } from '@/components/training/SectionDragWrapper';
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
  const duplicateSection = useTrainingPlanStore((s) => s.duplicateSection);
  const updateSection = useTrainingPlanStore((s) => s.updateSection);
  const reorderSections = useTrainingPlanStore((s) => s.reorderSections);
  const moveSectionToSession = useTrainingPlanStore((s) => s.moveSectionToSession);
  const invalidIds = useTrainingPlanStore((s) => s.invalidIds);
  const addSectionFromTemplate = useTrainingPlanStore((s) => s.addSectionFromTemplate);
  const addExerciseToSection = useTrainingPlanStore((s) => s.addExerciseToSection);
  const removeExerciseFromSection = useTrainingPlanStore((s) => s.removeExerciseFromSection);
  const duplicateExerciseInSection = useTrainingPlanStore((s) => s.duplicateExerciseInSection);
  const addSet = useTrainingPlanStore((s) => s.addSet);
  const removeSet = useTrainingPlanStore((s) => s.removeSet);
  const duplicateSet = useTrainingPlanStore((s) => s.duplicateSet);
  const updateSet = useTrainingPlanStore((s) => s.updateSet);
  const updateSessionName = useTrainingPlanStore((s) => s.updateSessionName);
  const updateSessionNotes = useTrainingPlanStore((s) => s.updateSessionNotes);
  const updateExerciseNotes = useTrainingPlanStore((s) => s.updateExerciseNotes);
  const updateExerciseMovementType = useTrainingPlanStore((s) => s.updateExerciseMovementType);
  // updateExerciseRestSeconds and revert available via useTrainingPlanStore when needed
  const updateDayNote = useTrainingPlanStore((s) => s.updateDayNote);
  const setStartDate = useTrainingPlanStore((s) => s.setStartDate);
  const moveSessionToDay = useTrainingPlanStore((s) => s.moveSessionToDay);
  const moveSessionToWeek = useTrainingPlanStore((s) => s.moveSessionToWeek);
  const sessionLockMap = useTrainingPlanStore((s) => s.sessionLockMap);
  const patchSessionLockState = useTrainingPlanStore((s) => s.patchSessionLockState);
  const sessionLockedError = useTrainingPlanStore((s) => s.sessionLockedError);
  const clearSessionLockedError = useTrainingPlanStore((s) => s.clearSessionLockedError);

  // ── Local UI state ──
  const [pageTab, setPageTab] = useState<'sessions' | 'photos'>('sessions');
  const [selectedDay, setSelectedDay] = useState(1);
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());
  /** Sessions currently undergoing an unlock/relock request (prevents double-click). */
  const [lockPendingIds, setLockPendingIds] = useState<Set<string>>(new Set());
  // Section collapse state lives at the page level so it survives moving a
  // section between sessions (a SectionCard instance otherwise unmounts and
  // its local state resets when the parent session changes).
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
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
  // State for the retroactive "mark session finished" confirmation dialog.
  const [markFinishedTarget, setMarkFinishedTarget] = useState<{
    sessionId: string;
    sessionName: string;
    completedAt: string;
  } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const dayHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set during `confirmLeave` so the popstate trap and pushState interceptor
  // don't re-trigger as we're intentionally tearing down the trap to leave.
  const skipDirtyTrapRef = useRef(false);
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
      // skipDirtyTrapRef is set by confirmLeave so we don't re-trap
      // the popstate fired by our own history.go() call.
      if (skipDirtyTrapRef.current) return;
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
      // Same skip flag — let confirmLeave's navigate() through.
      if (skipDirtyTrapRef.current) return origPush(...args);
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
    skipDirtyTrapRef.current = true;
    useTrainingPlanStore.setState({ isDirty: false });
    if (target === '__back__') {
      // We pushed two sentinels (one on mount, one inside the popstate
      // handler when the user clicked browser-back). Go back two entries
      // in a single call so we land on the real previous page.
      window.history.go(-2);
    } else if (target) {
      navigate(target);
    }
    // Reset after the current task — by then React has re-rendered with
    // isDirty=false and the effect cleanups have detached the listeners.
    setTimeout(() => { skipDirtyTrapRef.current = false; }, 0);
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
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);


  // ── Handlers ──
  const handleSave = async () => {
    clearSessionLockedError();
    await save();
  };

  /**
   * Acquires an Editing lock on a published session so the trainer can edit it.
   * On success, patches the lock state in the store immediately (optimistic) and
   * the SignalR event will confirm it asynchronously.
   */
  const handleUnlock = async (sessionId: string) => {
    if (!plan?.planId) return;
    setLockPendingIds((prev) => new Set([...prev, sessionId]));
    try {
      await unlockTrainingSession(plan.planId, sessionId);
      patchSessionLockState(sessionId, 'Editing', 'Coach');
    } catch (err) {
      showApiError(err, 'training.lock.unlockError');
    } finally {
      setLockPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  /**
   * Releases the Editing lock on a session (returns it to Stable).
   * Optimistically patches the store then triggers a save.
   */
  const handleRelock = async (sessionId: string) => {
    if (!plan?.planId) return;
    setLockPendingIds((prev) => new Set([...prev, sessionId]));
    try {
      await relockTrainingSession(plan.planId, sessionId);
      patchSessionLockState(sessionId, 'Stable', null);
    } catch (err) {
      showApiError(err, 'training.lock.relockError');
    } finally {
      setLockPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
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

  // ── Retroactive finish mutation ──
  const finishSessionMutation = useMutation({
    mutationFn: ({ sessionId, completedAt }: { sessionId: string; completedAt: string }) => {
      if (!planId) return Promise.reject(new Error('planId missing'));
      return finishSession(planId, sessionId, completedAt);
    },
    onSuccess: async () => {
      setMarkFinishedTarget(null);
      showSuccess('training.retroactiveFinish.success');
      // Reload plan so sessionExecutions update (lock state + completion badges recompute).
      // This page holds plan state locally via the Zustand store (setPlan), so the
      // imperative refetch + setPlan is the canonical refresh mechanism — consistent
      // with handleReset and other mutation handlers on this page.
      if (planId) {
        try {
          const data = await getTrainingPlan(planId);
          setPlan(data);
        } catch {
          // Non-fatal — reload on next navigation
        }
      }
    },
    onError: (err: unknown) => {
      showApiError(err, 'common.error');
    },
  });

  const handleConfirmMarkFinished = () => {
    if (!markFinishedTarget) return;
    finishSessionMutation.mutate({
      sessionId: markFinishedTarget.sessionId,
      completedAt: markFinishedTarget.completedAt,
    });
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
  // Week is "finished" — read-only historical record — when it's published AND
  // the current date is on or after the start of the next week.
  const isCurrentWeekFinished =
    !!plan && !!currentWeek && isWeekFinished(plan, currentWeek.weekNumber, currentWeek.status);

  // Derived locks reflecting client-side completions — exercises/sections/sessions
  // the client has already marked finished must not be edited.
  const planLocks = useMemo(() => computePlanLocks(plan), [plan]);

  // The currently-selected (week, dayOfWeek) is strictly before today — used
  // to hide affordances that only make sense in the future (e.g. "add
  // training session", which would attach a brand-new session to a day that
  // has already happened).
  const isSelectedDayInPast =
    !!plan && isDayInPast(plan, selectedWeek, selectedDay);

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
    return plan.weeks.map((w) => {
      const finished = isWeekFinished(plan, w.weekNumber, w.status);
      // Calendar date range (Mon–Sun) for the second row, derived from the
      // plan's startDate. `null` when the plan has no startDate — the tab
      // falls back to single-line label rendering.
      const wkStart = weekStartDate(plan, w.weekNumber);
      let dateLabel: string | null = null;
      if (wkStart) {
        const wkEnd = new Date(wkStart);
        wkEnd.setDate(wkStart.getDate() + 6);
        const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
        dateLabel = `${fmt(wkStart)} – ${fmt(wkEnd)}`;
      }
      return {
        index: w.weekNumber,
        label: t('nutrition.weekLabel', { number: w.weekNumber }),
        isPublished: w.status === 'Published' && !finished,
        isFinished: finished,
        dateLabel,
      };
    });
  }, [plan, t]);

  // Day tab data. Each tab carries an optional `dateLabel` like "13.5." derived
  // from the plan's startDate; it shows under the day name. When the plan has
  // no startDate (or the math otherwise can't resolve), the field is null and
  // nothing extra renders.
  const dayTabs = useMemo(() => {
    if (!currentWeek) return [];
    const wkStart = plan ? weekStartDate(plan, currentWeek.weekNumber) : null;
    return DAY_KEYS.map((key, idx) => {
      const dayOfWeek = idx + 1;
      const sessions = (currentWeek.sessions ?? []).filter((s) => s.dayOfWeek === dayOfWeek);
      // Sum workouts (sections) across every session on this day. A
      // "workout" in this app's vocabulary is a section — one EMOM /
      // Tabata / Standard block. The earlier exercise count was too
      // granular and didn't match the "N workouts" header the user sees
      // elsewhere (e.g. "6 workoutů · 68 min").
      const workoutCount = sessions.reduce((sum, s) => sum + (s.sections?.length ?? 0), 0);
      let dateLabel: string | null = null;
      if (wkStart) {
        const d = new Date(wkStart);
        d.setDate(wkStart.getDate() + (dayOfWeek - 1));
        dateLabel = `${d.getDate()}.${d.getMonth() + 1}.`;
      }
      return {
        index: dayOfWeek,
        key,
        label: t(`nutrition.${key}`),
        badge: sessions.length > 0 ? `${sessions.length}t · ${workoutCount}w` : '—',
        dateLabel,
      };
    });
  }, [currentWeek, plan, t]);

  // Open all sessions but collapse all exercises on day/week change or initial load
  const [planLoaded, setPlanLoaded] = useState(false);
  useEffect(() => {
    if (plan && !planLoaded) setPlanLoaded(true);
  }, [plan, planLoaded]);

  // One-shot: when the plan first loads, if today falls inside the currently
  // selected week, default `selectedDay` to today's weekday. Subsequent plan
  // refreshes (saves, navigation back) don't re-fire — the trainer's own day
  // selection is preserved.
  const didApplyTodayDay = useRef(false);
  useEffect(() => {
    if (!plan || didApplyTodayDay.current) return;
    didApplyTodayDay.current = true;
    const wd = todayWeekdayInPlan(plan, selectedWeek);
    if (wd != null) setSelectedDay(wd);
  }, [plan, selectedWeek]);

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
            allowFoodCategory={false}
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
              <span className="inline-flex flex-col items-center leading-tight">
                {/* Row 1 — gold workload badge as a small eyebrow. The
                    `px-2 py-[2px]` padding gives the label breathing room
                    inside the pill — the previous `px-[5px]` alone read as
                    cramped because there was no vertical padding. */}
                {day.badge && (
                  <span
                    className={cn(
                      'text-[10px] rounded-full px-2 py-[2px]',
                      'bg-accent-bg text-accent',
                    )}
                  >
                    {day.badge}
                  </span>
                )}
                {/* Row 2 — day name + calendar date inline. Dot separator
                    + date only when the plan has a startDate. The date
                    adopts the button's stronger color when this tab is
                    selected so the fontWeight bump (400→500 inherited from
                    the parent button style) actually reads — leaving the
                    permanent `text-text3` override hid the weight change
                    under the lighter color. */}
                <span className={day.badge ? 'mt-0.5' : undefined}>
                  {day.label}
                  {day.dateLabel && (
                    <>
                      <span className="text-text4"> · </span>
                      <span
                        className={cn(
                          'tabular-nums',
                          !weekViewExpanded && day.index === selectedDay
                            ? 'font-medium'
                            : 'text-text3',
                        )}
                      >
                        {day.dateLabel}
                      </span>
                    </>
                  )}
                </span>
              </span>
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
              if (isCurrentWeekFinished || isSelectedDayInPast) return;
              if (e.dataTransfer.types.includes('application/session-json')) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => {
              if (isCurrentWeekFinished || isSelectedDayInPast) return;
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
            {/*
              Inner wrapper carries the read-only styling for finished weeks.
              `opacity-70` + `select-none` provide the visual cue, but we do
              NOT block pointer events at the wrapper level — that would also
              kill the harmless expand/collapse toggles on sessions, workouts,
              and exercises. The actual edit handlers (drag-drop guards plus
              the section/exercise edit callbacks elsewhere on this page)
              short-circuit on `isCurrentWeekFinished`, so data stays
              read-only while navigation continues to work.
            */}
            <div
              className={cn(
                isCurrentWeekFinished && 'opacity-70 select-none',
              )}
            >
            {/* Day note — read-only when the selected day has already
                passed (existing text stays visible, "Add note" affordance
                is hidden). */}
            <DayNoteInput
              note={currentWeek?.dayNotes?.[selectedDay]}
              onChange={(n) => updateDayNote(selectedWeek, selectedDay, n)}
              addLabel={t('training.addDayNote')}
              placeholder={t('training.dayNotePlaceholder')}
              disabled={isSelectedDayInPast}
            />

            {/* Gated-save inline error — shown when a save attempt returned 409
                session_locked. Names the blocked session(s) and offers an
                unlock CTA. Cleared on next successful save. */}
            {sessionLockedError && sessionLockedError.length > 0 && (
              <div
                className={cn(
                  'mb-3 rounded-md border px-3 py-2',
                  'border-red/40 bg-red/5 text-text',
                )}
                role="alert"
              >
                <p className="text-[12px] font-medium text-red mb-1">
                  {t('training.lock.sessionLockedError')}
                </p>
                <ul className="mb-2 list-inside list-disc">
                  {sessionLockedError
                    .filter((sid) => sid !== 'unknown')
                    .map((sid) => {
                      const sessionName =
                        plan?.weeks
                          .flatMap((w) => w.sessions)
                          .find((s) => s.sessionId === sid)?.name ||
                        t('training.untitledSession');
                      return (
                        <li key={sid} className="text-[11px] text-text2">
                          {sessionName}
                        </li>
                      );
                    })}
                  {sessionLockedError.includes('unknown') &&
                    sessionLockedError.length === 1 && (
                      <li className="text-[11px] text-text2">
                        {t('training.lock.unlockToSave')}
                      </li>
                    )}
                </ul>
                <p className="text-[11px] text-text3">
                  {t('training.lock.unlockToSave')}
                </p>
                <button
                  type="button"
                  onClick={() => clearSessionLockedError()}
                  className="mt-1 text-[11px] text-text4 underline hover:text-text2 transition-colors"
                >
                  {t('common.close')}
                </button>
              </div>
            )}

            {daySessions.length === 0 && (
              <div className="py-12 text-center text-[13px] text-text3">
                {t('training.restDay')}
              </div>
            )}

            {daySessions.map((session) => {
              const isSessionOpen = !collapsedSessions.has(session.sessionId);
              // A session is "client-locked" when the client has completed every
              // section in it (planLocks.sessionIds, derived from completions).
              const isClientLockedSession = planLocks.sessionIds.has(session.sessionId);
              // Execution record for this session — present when the client has
              // interacted with it (at least one set logged or session finished).
              const sessionExec = plan?.sessionExecutions?.find(
                (e) => e.sessionId === session.sessionId,
              );
              // A past session is "completed" (read-only) when the client
              // formally finished the workout log (isSessionFinished=true).
              // Skipped or untouched past sessions remain editable per AC.
              const isPastCompletedSession =
                isSelectedDayInPast && (sessionExec?.isSessionFinished ?? false);
              // Read-only when client-locked OR the client actually finished
              // this specific session. Sessions the client never touched or
              // skipped stay editable even when in the past.
              const isSessionReadOnly = isClientLockedSession || isPastCompletedSession;
              // True when the session is in the past AND not completed — these
              // sessions show the "Mark finished" retroactive affordance.
              const isPastUnfinishedSession =
                isSelectedDayInPast && !isPastCompletedSession && !isClientLockedSession;

              // ── Edit-lock state (distinct from completion-based planLocks) ──
              // Session edit-lock is only relevant for published sessions. For
              // draft sessions there is no lock gate — they are always editable.
              const isPublishedSession = currentWeek?.status === 'Published';
              const sessionLockEntry = isPublishedSession
                ? sessionLockMap.get(session.sessionId)
                : undefined;
              // Absent from map = Stable (no active lock).
              const sessionEditLockState = sessionLockEntry?.lockState ?? 'Stable';
              const isLive = sessionEditLockState === 'Live';
              const isEditing = sessionEditLockState === 'Editing';
              const isLockPending = lockPendingIds.has(session.sessionId);
              // For published sessions, only allow content editing when in Editing state.
              // Stable = locked (must unlock first); Live = locked by client workout.
              const isEditLocked =
                isPublishedSession && (isLive || sessionEditLockState === 'Stable');
              // Combined read-only guard (completion-based OR edit-locked).
              const isSessionEffectivelyReadOnly = isSessionReadOnly || isEditLocked;

              return (
                <SessionDragWrapper
                  key={session.sessionId}
                  sessionId={session.sessionId}
                  selectedDay={selectedDay}
                  selectedWeek={selectedWeek}
                  // Drag-out + drop-over rejected when this session is
                  // read-only (finished session OR past day) — reordering
                  // a historical session has no clinical value.
                  disabled={isSessionEffectivelyReadOnly}
                >
                  <div
                    className="rounded-md border border-border bg-bg transition-all duration-100 hover:border-border-md overflow-hidden"
                    style={{ borderLeft: '4px solid var(--accent)' }}
                  >
                  {/* Session header — tinted background (lighter version of the accent bar) */}
                  <div
                    className={cn(
                      'group flex items-center gap-1.5 px-3 py-2 cursor-grab active:cursor-grabbing select-none transition-colors',
                      isSessionOpen && 'border-b border-border',
                    )}
                    style={{ background: 'var(--accent-bg)' }}
                    onClick={() => toggleSession(session.sessionId)}
                  >
                    {/* Drag handle indicator — visual hint that the session is draggable */}
                    <span
                      className="text-text4 select-none"
                      style={{ fontSize: 14 }}
                      aria-hidden="true"
                    >
                      ⠿
                    </span>
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
                        placeholder={t('training.sessionNamePlaceholder')}
                        readOnly={isSessionEffectivelyReadOnly}
                        className={cn(
                          'w-full bg-transparent text-[13px] font-semibold text-text outline-none placeholder:text-text3 rounded-sm',
                          invalidIds.has(session.sessionId) && 'ring-1 ring-red',
                          isSessionEffectivelyReadOnly && 'cursor-default',
                        )}
                        style={{ fontFamily: 'inherit' }}
                      />
                    </span>
                    <span className="text-xs text-text3 tabular-nums inline-flex items-center gap-1.5 flex-wrap">
                      {(() => {
                        const total = session.sections.length;
                        const durations = session.sections.map((sec) =>
                          estimatedSectionDurationSeconds(sec.format, sec.formatConfig),
                        );
                        const timedSeconds = durations.reduce<number>((sum, d) => sum + (d ?? 0), 0);
                        const untimedCount = durations.filter((d) => d == null || d === 0).length;
                        const parts: string[] = [t('training.workoutCount', { count: total })];
                        if (timedSeconds > 0) parts.push(formatDurationCompact(timedSeconds));
                        if (timedSeconds > 0 && untimedCount > 0) {
                          parts.push(t('training.workoutUntimedCount', { count: untimedCount }));
                        }
                        return parts.join(' · ');
                      })()}
                      {(() => {
                        // Session-level completion badge — derive from execution data.
                        // sessionExec is already resolved above in the outer scope.
                        const allExercises = session.sections.flatMap((sec) => sec.exercises);
                        const { state, counts } = deriveSessionCompletionState(
                          sessionExec ? [sessionExec] : undefined,
                          session.sessionId,
                          allExercises,
                        );
                        if (state === 'none' || state === 'in-progress') return null;
                        return (
                          <CompletionBadge
                            kind="session"
                            state={state}
                            counts={counts}
                          />
                        );
                      })()}
                    </span>
                    {/* ── Edit-lock affordances (published sessions only) ─────────
                        Live   → in-progress badge + disabled affordance with tooltip
                        Stable → "Unlock to edit" button
                        Editing → "Relock" button
                    ──────────────────────────────────────────────────────────── */}
                    {isPublishedSession && isLive && (
                      <span
                        className={cn(
                          'shrink-0 inline-flex items-center gap-1 rounded-sm border px-2 py-[2px]',
                          'text-[10px] font-medium',
                          'border-orange/50 text-orange bg-orange/10',
                        )}
                        title={t('training.lock.liveTooltip')}
                        aria-label={t('training.lock.liveTooltip')}
                      >
                        <span aria-hidden="true">●</span>
                        {t('training.lock.liveLabel')}
                      </span>
                    )}
                    {isPublishedSession && !isLive && !isEditing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleUnlock(session.sessionId);
                        }}
                        disabled={isLockPending}
                        className={cn(
                          'shrink-0 rounded-sm border px-2 py-[2px] text-[10px] font-medium transition-colors',
                          'border-accent/50 text-accent bg-accent-bg',
                          'hover:bg-accent/10 hover:border-accent',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                        )}
                        aria-label={t('training.lock.unlockLabel')}
                      >
                        {isLockPending ? t('training.lock.unlocking') : t('training.lock.unlockLabel')}
                      </button>
                    )}
                    {isPublishedSession && isEditing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRelock(session.sessionId);
                        }}
                        disabled={isLockPending}
                        className={cn(
                          'shrink-0 rounded-sm border px-2 py-[2px] text-[10px] font-medium transition-colors',
                          'border-border text-text3 bg-bg2',
                          'hover:bg-bg3 hover:border-border-md',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                        )}
                        aria-label={t('training.lock.relockLabel')}
                      >
                        {isLockPending ? t('training.lock.relocking') : t('training.lock.relockLabel')}
                      </button>
                    )}
                    {/* "Mark finished" retroactive affordance — only shown on
                        past sessions the client did not complete. The button is
                        visually distinct (tinted outline style) to separate it
                        clearly from the client's live-finish flow. */}
                    {isPastUnfinishedSession && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const completedAt = sessionScheduledDateUtc(plan, selectedWeek, selectedDay);
                          if (!completedAt) {
                            showError('training.retroactiveFinish.noStartDate');
                            return;
                          }
                          setMarkFinishedTarget({
                            sessionId: session.sessionId,
                            sessionName: session.name || t('training.untitledSession'),
                            completedAt,
                          });
                        }}
                        disabled={finishSessionMutation.isPending}
                        className={cn(
                          'shrink-0 rounded-sm border px-2 py-[2px] text-[10px] font-medium transition-colors',
                          'border-amber-500/50 text-amber-600 bg-amber-50/80',
                          'hover:bg-amber-100 hover:border-amber-500',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                          'dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-500/40',
                        )}
                        title={t('training.retroactiveFinish.buttonTooltip')}
                        aria-label={t('training.retroactiveFinish.buttonLabel')}
                      >
                        {t('training.retroactiveFinish.buttonLabel')}
                      </button>
                    )}
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
                      disabled={isSessionEffectivelyReadOnly}
                      style={{
                        background: 'none', border: 'none',
                        cursor: isSessionEffectivelyReadOnly ? 'not-allowed' : 'pointer', padding: '2px 4px',
                        fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
                        transition: 'color 0.1s',
                        opacity: isSessionEffectivelyReadOnly ? 0.4 : 1,
                      }}
                      onMouseEnter={(e) => { if (!isSessionEffectivelyReadOnly) e.currentTarget.style.color = 'var(--text2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
                      title={t('training.duplicateSession')}
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeSession(selectedWeek, session.sessionId); }}
                      disabled={isSessionEffectivelyReadOnly}
                      style={{
                        background: 'none', border: 'none',
                        cursor: isSessionEffectivelyReadOnly ? 'not-allowed' : 'pointer', padding: '2px 4px',
                        fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
                        transition: 'color 0.1s',
                        opacity: isSessionEffectivelyReadOnly ? 0.4 : 1,
                      }}
                      onMouseEnter={(e) => { if (!isSessionEffectivelyReadOnly) e.currentTarget.style.color = 'var(--red)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
                      title={t('training.removeSession')}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Session body — animated collapse */}
                  <div className="collapse-grid" data-open={isSessionOpen}>
                    <div className="collapse-content">
                      {/* Session note — disabled when the session is locked
                          (every section finished by the client) or the
                          selected day has already passed. Visible but read-
                          only so the trainer can still see the historical
                          note text. */}
                      <div style={{ padding: '4px 8px 6px' }}>
                        <input
                          type="text"
                          value={session.notes ?? ''}
                          onChange={(e) => updateSessionNotes(selectedWeek, session.sessionId, e.target.value)}
                          placeholder={t('training.sessionNotesPlaceholder')}
                          disabled={isSessionEffectivelyReadOnly}
                          style={{
                            width: '100%', border: 'none', outline: 'none', background: 'transparent',
                            fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit', fontStyle: 'italic',
                            padding: '2px 4px', borderRadius: 'var(--radius)', transition: 'background 0.1s',
                            cursor: isSessionEffectivelyReadOnly ? 'not-allowed' : 'text',
                          }}
                          onFocus={(e) => { if (!isSessionEffectivelyReadOnly) e.target.style.background = 'var(--bg-hover)'; }}
                          onBlur={(e) => { e.target.style.background = 'transparent'; }}
                        />
                      </div>

                      {/* Section cards — drag-and-drop reorder within this session */}
                      <div
                        className="px-2 pt-1"
                        onDragOver={(e) => {
                          if (isCurrentWeekFinished || isSessionEffectivelyReadOnly) return;
                          if (!e.dataTransfer.types.includes('application/section-json')) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          if (isCurrentWeekFinished || isSessionEffectivelyReadOnly) return;
                          if (!e.dataTransfer.types.includes('application/section-json')) return;
                          e.preventDefault();
                          try {
                            const data = JSON.parse(e.dataTransfer.getData('application/section-json'));
                            if (data.type !== 'section' || !data.sectionId) return;

                            // Compute target index from mouse Y over section children.
                            const sectionEls = Array.from(
                              e.currentTarget.querySelectorAll('[data-section-id]'),
                            );
                            let targetIndex = sectionEls.length;
                            for (let i = 0; i < sectionEls.length; i++) {
                              const rect = sectionEls[i].getBoundingClientRect();
                              if (e.clientY < rect.top + rect.height / 2) {
                                targetIndex = i;
                                break;
                              }
                            }

                            if (data.sessionId === session.sessionId) {
                              // Same-session reorder
                              const fromIdx = session.sections.findIndex((s) => s.sectionId === data.sectionId);
                              if (fromIdx < 0) return;
                              const toIdx = targetIndex > fromIdx ? targetIndex - 1 : targetIndex;
                              if (toIdx === fromIdx) return;
                              reorderSections(selectedWeek, session.sessionId, fromIdx, toIdx);
                            } else {
                              // Cross-session move within the same week
                              moveSectionToSession(
                                selectedWeek,
                                data.sessionId,
                                session.sessionId,
                                data.sectionId,
                                targetIndex,
                              );
                            }
                          } catch { /* ignore malformed payloads */ }
                        }}
                      >
                        {session.sections.map((section) => (
                          <SectionDragWrapper
                            key={section.sectionId}
                            sessionId={session.sessionId}
                            sectionId={section.sectionId}
                            // Drag-out + drop-over are both rejected when
                            // the host session is read-only (finished
                            // session OR past day) — reordering historical
                            // workouts has no clinical value.
                            disabled={isSessionEffectivelyReadOnly}
                          >
                          <SectionCard
                            section={section}
                            isExpanded={!collapsedSections.has(section.sectionId)}
                            onToggleExpanded={() => toggleSection(section.sectionId)}
                            hasError={invalidIds.has(section.sectionId)}
                            isSectionLocked={
                              // A section's inputs are read-only when any of:
                              //   - the section itself is finished by the client
                              //   - the whole session is client-locked (every
                              //     section finished by the client)
                              //   - the session is a past completed session
                              //     (client formally finished the workout log)
                              //   - the session has an edit lock (Stable or Live)
                              // NOTE: isSelectedDayInPast alone no longer locks —
                              // past skipped / untouched sessions are editable.
                              planLocks.sectionIds.has(section.sectionId) ||
                              isClientLockedSession ||
                              isPastCompletedSession ||
                              isEditLocked
                            }
                            lockedExerciseIds={new Set(
                              section.exercises
                                .filter((ex) =>
                                  planLocks.exerciseKeys.has(
                                    exerciseLockKey(
                                      session.sessionId,
                                      section.sectionId,
                                      ex.exerciseExternalId,
                                    ),
                                  ),
                                )
                                .map((ex) => ex.exerciseExternalId),
                            )}
                            exerciseDetailsMap={exerciseDetailsMap}
                            exerciseFullMap={exerciseFullMap}
                            sessionExecution={sessionExec}
                            onUpdate={(patch) =>
                              updateSection(selectedWeek, session.sessionId, section.sectionId, patch)
                            }
                            onRemove={() =>
                              removeSection(selectedWeek, session.sessionId, section.sectionId)
                            }
                            onDuplicate={() =>
                              duplicateSection(selectedWeek, session.sessionId, section.sectionId)
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
                            onDuplicateSet={(exIdx, sIdx) =>
                              duplicateSet(selectedWeek, session.sessionId, section.sectionId, exIdx, sIdx)
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
                            onSaveAsTemplate={() =>
                              setSaveAsTemplateTarget({
                                sessionId: session.sessionId,
                                sectionId: section.sectionId,
                                sectionName: section.name || t('training.section.defaultName'),
                              })
                            }
                          />
                          </SectionDragWrapper>
                        ))}
                      </div>

                      {/* Add section affordances — hidden entirely when the
                          session is locked (every section in it is finished
                          by the client) OR the day already passed. Adding
                          new workouts to a completed session — or to any
                          historical day — has no clinical value. */}
                      {!isSessionEffectivelyReadOnly && (
                        <div className="flex items-center gap-3 px-3 py-2 border-t border-border">
                          <button
                            type="button"
                            onClick={() => addSection(selectedWeek, session.sessionId, 'Standard')}
                            className="flex items-center gap-1 text-[11px] text-text3 transition-colors hover:text-text whitespace-nowrap"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            <span>+</span>
                            <span>{t('training.section.create')}</span>
                          </button>
                          {sectionTemplates.length > 0 && (
                            <>
                              <span className="text-text4 text-[10px]">·</span>
                              <div className="flex-1 min-w-[180px]">
                                <SectionTemplateSearch
                                  templates={sectionTemplates}
                                  onSelect={(tpl) =>
                                    addSectionFromTemplate(selectedWeek, session.sessionId, tpl)
                                  }
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                </SessionDragWrapper>
              );
            })}

            {/* Add session — creates an unnamed session immediately; user
                can rename it inline via the session-header input. Hidden when
                the selected day is in the past so trainers can't attach a
                brand-new session to a date that has already happened. */}
            {!isSelectedDayInPast && (
              <div
                className="flex items-center gap-1.5 px-3 py-2 mt-2 border border-dashed border-border rounded-md cursor-pointer text-text3 text-[13px] transition-colors hover:bg-bg-hover hover:text-text"
                onClick={() => addSession(selectedWeek, selectedDay, '')}
              >
                <span>+</span>
                <span>{t('training.addSessionButton')}</span>
              </div>
            )}
            </div>
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

      {/* ── Mark Session Finished (Retroactive) Dialog ── */}
      <Dialog
        open={!!markFinishedTarget}
        onClose={() => setMarkFinishedTarget(null)}
        title={t('training.retroactiveFinish.dialogTitle')}
        maxWidth={420}
        footer={
          <>
            <Button onClick={() => setMarkFinishedTarget(null)} disabled={finishSessionMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="brand"
              onClick={handleConfirmMarkFinished}
              disabled={finishSessionMutation.isPending}
            >
              {finishSessionMutation.isPending
                ? t('common.saving')
                : t('training.retroactiveFinish.dialogConfirm')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {t('training.retroactiveFinish.dialogBody', {
            name: markFinishedTarget?.sessionName ?? '',
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

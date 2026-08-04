import { create } from 'zustand';
import type {
  TrainingPlanDetail,
  RawTrainingPlanDetail,
  RawTrainingWorkout,
  TrainingWorkout,
  TrainingSession,
  SessionExercise,
  ExerciseSet,
  UpdateTrainingPlanRequest,
  UpdateWorkoutRequest,
  UpdateSessionExerciseRequest,
  WorkoutFormat,
  MovementType,
  SetType,
  WodConfig,
  SessionLockStateDto,
} from '@/api/training-plan-types';
import type { WorkoutTemplateResponse } from '@/api/sectionTemplates';
import { updateTrainingPlan, publishTrainingWeek, getTrainingPlan } from '@/api/training-plans';
import { showApiError, showSuccess, getRfc7807ErrorCode } from '@/lib/api-errors';
import { currentWeekNumber } from '@/lib/training-plan-dates';
import { useToastStore } from '@/stores/toast';
import i18n from '@/i18n';

interface TrainingPlanState {
  plan: TrainingPlanDetail | null;
  originalPlan: TrainingPlanDetail | null;
  isDirty: boolean;
  isSaving: boolean;
  selectedWeek: number;
  /** IDs of session/section entities flagged by the last failed pre-save validation. */
  invalidIds: Set<string>;
  /**
   * Per-session edit-lock state map keyed by sessionId.
   * Built from `plan.sessionLockStates` on load; absent entry = "Stable".
   * Patched by the `sessioneditlockchanged` SignalR event handler (via
   * `refreshCompletions`, which also refreshes lock state from the server).
   *
   * Do NOT conflate with `training-plan-locks.ts` (completion-based exercise
   * locking — a different concept).
   */
  sessionLockMap: Map<string, Pick<SessionLockStateDto, 'lockState' | 'lockHolder'>>;
  /**
   * Patch a single session's lock state in the map.
   * Called by the SignalR `sessioneditlockchanged` handler for live updates.
   */
  patchSessionLockState: (
    sessionId: string,
    lockState: SessionLockStateDto['lockState'],
    lockHolder: SessionLockStateDto['lockHolder'],
  ) => void;

  setPlan: (plan: RawTrainingPlanDetail) => void;
  setSelectedWeek: (week: number) => void;
  revert: () => void;

  // Session mutations
  addSession: (weekNumber: number, dayOfWeek: number, name: string) => void;
  removeSession: (weekNumber: number, sessionId: string) => void;
  moveSessionToDay: (weekNumber: number, sessionId: string, targetDayOfWeek: number, insertIndex?: number) => void;
  updateSessionName: (weekNumber: number, sessionId: string, name: string) => void;
  updateSessionNotes: (weekNumber: number, sessionId: string, notes: string) => void;

  // Section mutations
  addSection: (weekNumber: number, sessionId: string, format?: WorkoutFormat) => void;
  removeSection: (weekNumber: number, sessionId: string, sectionId: string) => void;
  duplicateSection: (weekNumber: number, sessionId: string, sectionId: string) => void;
  updateSection: (weekNumber: number, sessionId: string, sectionId: string, patch: Partial<Pick<TrainingWorkout, 'name' | 'format' | 'formatConfig' | 'notes'>>) => void;
  reorderSections: (weekNumber: number, sessionId: string, fromIdx: number, toIdx: number) => void;
  moveSectionToSession: (
    weekNumber: number,
    fromSessionId: string,
    toSessionId: string,
    sectionId: string,
    toIdx: number,
  ) => void;
  addSectionFromTemplate: (weekNumber: number, sessionId: string, template: WorkoutTemplateResponse) => void;

  // Exercise mutations (now scoped to section)
  addExerciseToSection: (weekNumber: number, sessionId: string, sectionId: string, exercise: { exerciseExternalId: string; exerciseName: string }) => void;
  removeExerciseFromSection: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number) => void;
  duplicateExerciseInSection: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number) => void;

  // Legacy exercise mutations (kept for DnD cross-session moves — operate on the first section)
  addExercise: (weekNumber: number, sessionId: string, exercise: { exerciseExternalId: string; exerciseName: string }) => void;
  removeExercise: (weekNumber: number, sessionId: string, exerciseIndex: number) => void;
  duplicateExercise: (weekNumber: number, sessionId: string, exerciseIndex: number) => void;
  moveExerciseToSession: (weekNumber: number, fromSessionId: string, toSessionId: string, fromIndex: number, toIndex: number) => void;

  // Set mutations (section-scoped)
  addSet: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number) => void;
  removeSet: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, setIndex: number) => void;
  duplicateSet: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, setIndex: number) => void;
  updateSet: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, setIndex: number, updates: Partial<ExerciseSet>) => void;

  // Exercise field mutations (section-scoped)
  updateExerciseNotes: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, notes: string) => void;
  updateExerciseRestSeconds: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, restSeconds: number | null) => void;
  updateExerciseMovementType: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, movementType: MovementType) => void;

  // Session format mutations (session-level inheritable default)
  updateSessionFormat: (weekNumber: number, sessionId: string, format: WorkoutFormat, formatConfig?: WodConfig | null) => void;

  // Cross-week mutations
  moveSessionToWeek: (fromWeek: number, toWeek: number, sessionId: string, targetDayOfWeek: number, insertIndex?: number) => void;
  copyDayToWeek: (fromWeek: number, fromDay: number, toWeek: number, toDay: number) => void;

  // Day mutations
  updateDayNote: (weekNumber: number, dayOfWeek: number, note: string) => void;
  swapDays: (weekNumber: number, dayA: number, dayB: number) => void;
  copyDayToDay: (weekNumber: number, fromDay: number, toDay: number) => void;
  reorderDay: (weekNumber: number, fromDay: number, toPosition: number) => void;

  // Week mutations
  addWeek: () => void;
  removeWeek: (weekNumber: number) => void;

  setStartDate: (date: string | null) => void;

  // Persistence
  save: () => Promise<void>;
  publishWeek: (weekNumber: number) => Promise<void>;
  /**
   * Re-fetch the current plan from the server and overwrite `completions`,
   * `sessionExecutions`, and `sessionLockStates` on both `plan` and
   * `originalPlan`. Used by the SignalR `trainingprogressupdated` listener
   * so the editor reacts in real time to client-side completions and
   * session-finish state without clobbering unsaved trainer edits.
   * Also rebuilds `sessionLockMap` from the fresh response.
   */
  refreshCompletions: () => Promise<void>;

  /**
   * Set when a save attempt returns 409 session_locked.
   * Contains the IDs of sessions that blocked the save (derived UI-side
   * as published sessions with changes that are NOT in Editing state).
   * Cleared on the next successful save, plan load, or explicit dismiss.
   */
  sessionLockedError: string[] | null;
  /** Clear the session-locked inline error (e.g. after the trainer unlocks). */
  clearSessionLockedError: () => void;
}

function updateSession(
  plan: TrainingPlanDetail,
  weekNumber: number,
  sessionId: string,
  updater: (session: TrainingSession) => TrainingSession,
): TrainingPlanDetail {
  return {
    ...plan,
    weeks: plan.weeks.map((w) =>
      w.weekNumber === weekNumber
        ? { ...w, sessions: w.sessions.map((s) => (s.sessionId === sessionId ? updater(s) : s)) }
        : w,
    ),
  };
}

/**
 * Recompute a session's read-only `allExercises` view — standalone exercises
 * plus every workout's nested exercises — mirroring what the backend
 * computes server-side. Called after every local mutation that changes
 * `workouts` or `standaloneExercises` so the two never drift apart.
 */
function recomputeAllExercises(session: TrainingSession): TrainingSession {
  return {
    ...session,
    allExercises: [
      ...session.standaloneExercises,
      ...session.workouts.flatMap((w) => w.exercises),
    ],
  };
}

/** Patch a specific workout within a session; also recomputes the flat exercises view. */
function patchSection(
  plan: TrainingPlanDetail,
  weekNumber: number,
  sessionId: string,
  sectionId: string,
  updater: (section: TrainingWorkout) => TrainingWorkout,
): TrainingPlanDetail {
  return updateSession(plan, weekNumber, sessionId, (s) => {
    const workouts = s.workouts.map((sec) =>
      sec.workoutId === sectionId ? updater(sec) : sec,
    );
    return recomputeAllExercises({ ...s, workouts });
  });
}

/**
 * Collapse an exercise to a single set with no rest — the WOD round prescription.
 * Used when a section's format flips Standard → non-Standard.
 * No-op when the exercise already has 0 or 1 sets and no rest.
 */
function pruneToSingleSet(ex: SessionExercise): SessionExercise {
  if (ex.sets.length === 0) return ex;
  const [first] = ex.sets;
  if (ex.sets.length === 1 && first.restSeconds == null) return ex;
  return { ...ex, sets: [{ ...first, restSeconds: null }] };
}

/**
 * After a section format change, prune every exercise to a single (no-rest) set
 * when the new format is non-Standard.
 */
function pruneSectionExercisesIfNonStandard(
  exercises: SessionExercise[],
  sectionFormat: WorkoutFormat,
): SessionExercise[] {
  if (sectionFormat === 'Standard') return exercises;
  return exercises.map(pruneToSingleSet);
}

/** Create a default single-set exercise from a search result. */
function makeNewExercise(exercise: { exerciseExternalId: string; exerciseName: string }, order: number): SessionExercise {
  return {
    ...exercise,
    exerciseId: crypto.randomUUID(),
    order,
    movementType: 'Reps' as const,
    format: null,
    formatConfig: null,
    notes: null,
    restSeconds: null,
    sets: [{ setNumber: 1, type: 'Normal' as const, reps: null, weightKg: null, durationSeconds: null, rpe: null, distanceMeters: null, restSeconds: null }],
  };
}

/** Build the sessionLockMap from the plan's sessionLockStates array. */
function buildLockMap(
  lockStates: SessionLockStateDto[] | undefined,
): Map<string, Pick<SessionLockStateDto, 'lockState' | 'lockHolder'>> {
  const map = new Map<string, Pick<SessionLockStateDto, 'lockState' | 'lockHolder'>>();
  for (const s of lockStates ?? []) {
    map.set(s.sessionId, { lockState: s.lockState, lockHolder: s.lockHolder });
  }
  return map;
}

export const useTrainingPlanStore = create<TrainingPlanState>((set, get) => ({
  plan: null,
  originalPlan: null,
  isDirty: false,
  isSaving: false,
  selectedWeek: 1,
  invalidIds: new Set(),
  sessionLockMap: new Map(),
  sessionLockedError: null,
  clearSessionLockedError: () => set({ sessionLockedError: null }),

  setPlan: (rawPlan) => {
    // Normalize exercises helper — fills in defensive defaults; the backend
    // always emits well-formed data for this shape (#857 phase 3a — no
    // production data predates it), so fallbacks here are defensive only.
    const normalizeExercise = (e: SessionExercise): SessionExercise => ({
      ...e,
      exerciseId: e.exerciseId ?? crypto.randomUUID(),
      exerciseExternalId: e.exerciseExternalId ?? '',
      exerciseName: e.exerciseName ?? '',
      order: e.order ?? 1,
      movementType: (e.movementType ?? 'Reps') as MovementType,
      format: (e.format ?? null) as WorkoutFormat | null,
      formatConfig: e.formatConfig ?? null,
      sets: (e.sets ?? []).map((s) => ({
        setNumber: s.setNumber ?? 1,
        type: (s.type ?? 'Normal') as SetType,
        reps: s.reps ?? null,
        weightKg: s.weightKg ?? null,
        durationSeconds: s.durationSeconds ?? null,
        rpe: s.rpe ?? null,
        distanceMeters: s.distanceMeters ?? null,
        restSeconds: s.restSeconds ?? null,
      })),
    });

    const normalizeWorkout = (
      w: RawTrainingWorkout,
      sessionFormat: WorkoutFormat,
      idx: number,
    ): TrainingWorkout => ({
      workoutId: w.workoutId ?? crypto.randomUUID(),
      order: w.order ?? idx,
      name: w.name ?? 'Sekce',
      format: (w.format ?? sessionFormat) as WorkoutFormat,
      formatConfig: w.formatConfig ?? null,
      notes: w.notes ?? null,
      exercises: (w.exercises ?? []).map(normalizeExercise),
    });

    // Flatten the wire's per-day nesting (weeks[].days[].sessions[]) back
    // into the flat sessions[]+dayOfWeek shape this app's store/UI has
    // always worked with — day-of-week now lives on the parent
    // `RawTrainingDay`, and a day note is `day.note` (collected into the
    // week-level `dayNotes` map the write side already expects).
    const plan: TrainingPlanDetail = {
      ...rawPlan,
      weeks: rawPlan.weeks.map((w) => {
        const sessions: TrainingSession[] = [];
        const dayNotes: Record<number, string> = {};
        for (const day of w.days ?? []) {
          if (day.note) {
            dayNotes[day.dayOfWeek] = day.note;
          }
          for (const s of day.sessions ?? []) {
            const sessionFormat = (s.format ?? 'Standard') as WorkoutFormat;
            const workouts = (s.workouts ?? []).map((sec, idx) =>
              normalizeWorkout(sec, sessionFormat, idx),
            );
            const standaloneExercises = (s.standaloneExercises ?? []).map(normalizeExercise);
            sessions.push(
              recomputeAllExercises({
                ...s,
                dayOfWeek: day.dayOfWeek,
                format: sessionFormat,
                formatConfig: s.formatConfig ?? null,
                workouts,
                standaloneExercises,
                allExercises: [],
              }),
            );
          }
        }
        return {
          weekNumber: w.weekNumber,
          status: w.status,
          datePublished: w.datePublished,
          sessions,
          dayNotes: Object.keys(dayNotes).length > 0 ? dayNotes : null,
        };
      }),
    };
    // Default the selected week to whichever week contains today, falling back
    // to week 1 when the plan has no startDate or is wholly in the future / past.
    // Also build the sessionLockMap from the plan's lock state for cold-load rendering.
    set({
      plan,
      originalPlan: structuredClone(plan),
      isDirty: false,
      selectedWeek: currentWeekNumber(plan),
      sessionLockMap: buildLockMap(rawPlan.sessionLockStates),
    });
  },
  setSelectedWeek: (week) => set({ selectedWeek: week }),
  revert: () => {
    const { originalPlan } = get();
    if (!originalPlan) return;
    set({ plan: structuredClone(originalPlan), isDirty: false });
  },

  patchSessionLockState: (sessionId, lockState, lockHolder) => {
    set((state) => {
      const next = new Map(state.sessionLockMap);
      if (lockState === 'Stable') {
        // Stable = no active lock; remove from the map (absent = Stable).
        next.delete(sessionId);
      } else {
        next.set(sessionId, { lockState, lockHolder });
      }
      return { sessionLockMap: next };
    });
  },

  addSession: (weekNumber, dayOfWeek, name) => {
    const { plan } = get();
    if (!plan) return;
    const defaultSection: TrainingWorkout = {
      workoutId: crypto.randomUUID(),
      order: 0,
      name: '',
      format: 'Standard',
      formatConfig: null,
      notes: null,
      exercises: [],
    };
    const newSession: TrainingSession = {
      sessionId: crypto.randomUUID(),
      dayOfWeek,
      name,
      order: 1,
      format: 'Standard',
      formatConfig: null,
      workouts: [defaultSection],
      standaloneExercises: [],
      allExercises: [],
    };
    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) =>
          w.weekNumber === weekNumber
            ? { ...w, sessions: [...w.sessions, { ...newSession, order: w.sessions.filter((s) => s.dayOfWeek === dayOfWeek).length + 1 }] }
            : w,
        ),
      },
      isDirty: true,
    });
  },

  removeSession: (weekNumber, sessionId) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) =>
          w.weekNumber === weekNumber
            ? { ...w, sessions: w.sessions.filter((s) => s.sessionId !== sessionId) }
            : w,
        ),
      },
      isDirty: true,
    });
  },

  moveSessionToDay: (weekNumber, sessionId, targetDayOfWeek, insertIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) => {
          if (w.weekNumber !== weekNumber) return w;
          // Move session to target day
          let sessions = w.sessions.map((s) =>
            s.sessionId === sessionId ? { ...s, dayOfWeek: targetDayOfWeek } : s,
          );
          // Renumber orders within target day, inserting at position if given
          if (insertIndex != null) {
            const targetDaySessions = sessions
              .filter((s) => s.dayOfWeek === targetDayOfWeek && s.sessionId !== sessionId)
              .sort((a, b) => a.order - b.order);
            const moved = sessions.find((s) => s.sessionId === sessionId)!;
            targetDaySessions.splice(insertIndex, 0, moved);
            const orderMap = new Map(targetDaySessions.map((s, i) => [s.sessionId, i + 1]));
            sessions = sessions.map((s) =>
              orderMap.has(s.sessionId) ? { ...s, order: orderMap.get(s.sessionId)! } : s,
            );
          }
          return { ...w, sessions };
        }),
      },
      isDirty: true,
    });
  },

  updateSessionName: (weekNumber, sessionId, name) => {
    const { plan } = get();
    if (!plan) return;
    set({ plan: updateSession(plan, weekNumber, sessionId, (s) => ({ ...s, name })), isDirty: true });
  },

  updateSessionNotes: (weekNumber, sessionId, notes) => {
    const { plan } = get();
    if (!plan) return;
    set({ plan: updateSession(plan, weekNumber, sessionId, (s) => ({ ...s, notes: notes || null })), isDirty: true });
  },

  // ── Section mutations ──────────────────────────────────────────────────────

  addSection: (weekNumber, sessionId, format = 'Standard') => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => {
        const newSection: TrainingWorkout = {
          workoutId: crypto.randomUUID(),
          order: s.workouts.length,
          name: '',
          format,
          formatConfig: null,
          notes: null,
          exercises: [],
        };
        return recomputeAllExercises({ ...s, workouts: [...s.workouts, newSection] });
      }),
      isDirty: true,
    });
  },

  removeSection: (weekNumber, sessionId, sectionId) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => {
        const workouts = s.workouts
          .filter((sec) => sec.workoutId !== sectionId)
          .map((sec, i) => ({ ...sec, order: i }));
        return recomputeAllExercises({ ...s, workouts });
      }),
      isDirty: true,
    });
  },

  duplicateSection: (weekNumber, sessionId, sectionId) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => {
        const sourceIdx = s.workouts.findIndex((sec) => sec.workoutId === sectionId);
        if (sourceIdx === -1) return s;
        const source = s.workouts[sourceIdx];
        const clone: TrainingWorkout = {
          ...source,
          workoutId: crypto.randomUUID(),
          exercises: source.exercises.map((ex) => ({
            ...ex,
            exerciseId: crypto.randomUUID(),
            sets: ex.sets.map((st) => ({ ...st })),
          })),
        };
        const workouts = [
          ...s.workouts.slice(0, sourceIdx + 1),
          clone,
          ...s.workouts.slice(sourceIdx + 1),
        ].map((sec, i) => ({ ...sec, order: i }));
        return recomputeAllExercises({ ...s, workouts });
      }),
      isDirty: true,
    });
  },

  updateSection: (weekNumber, sessionId, sectionId, patch) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => {
        const next = { ...sec, ...patch };
        // If the section format flips to non-Standard, collapse every exercise
        // to a single (no-rest) set — its WOD round prescription.
        if (patch.format !== undefined && patch.format !== sec.format) {
          next.exercises = pruneSectionExercisesIfNonStandard(next.exercises, next.format);
        }
        return next;
      }),
      isDirty: true,
    });
  },

  reorderSections: (weekNumber, sessionId, fromIdx, toIdx) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => {
        const workouts = [...s.workouts];
        const [moved] = workouts.splice(fromIdx, 1);
        workouts.splice(toIdx, 0, moved);
        const reordered = workouts.map((sec, i) => ({ ...sec, order: i }));
        return recomputeAllExercises({ ...s, workouts: reordered });
      }),
      isDirty: true,
    });
  },

  moveSectionToSession: (weekNumber, fromSessionId, toSessionId, sectionId, toIdx) => {
    const { plan } = get();
    if (!plan) return;
    if (fromSessionId === toSessionId) return;

    // Locate the source section
    const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) return;
    const fromSession = week.sessions.find((s) => s.sessionId === fromSessionId);
    if (!fromSession) return;
    const moved = fromSession.workouts.find((sec) => sec.workoutId === sectionId);
    if (!moved) return;

    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) => {
          if (w.weekNumber !== weekNumber) return w;
          return {
            ...w,
            sessions: w.sessions.map((s) => {
              if (s.sessionId === fromSessionId) {
                const workouts = s.workouts
                  .filter((sec) => sec.workoutId !== sectionId)
                  .map((sec, i) => ({ ...sec, order: i }));
                return recomputeAllExercises({ ...s, workouts });
              }
              if (s.sessionId === toSessionId) {
                const workouts = [...s.workouts];
                const insertAt = Math.max(0, Math.min(toIdx, workouts.length));
                workouts.splice(insertAt, 0, moved);
                const reordered = workouts.map((sec, i) => ({ ...sec, order: i }));
                return recomputeAllExercises({ ...s, workouts: reordered });
              }
              return s;
            }),
          };
        }),
      },
      isDirty: true,
    });
  },

  addSectionFromTemplate: (weekNumber, sessionId, template) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => {
        const newSection: TrainingWorkout = {
          workoutId: crypto.randomUUID(),
          order: s.workouts.length,
          name: template.name ?? '',
          format: (template.defaultFormat ?? 'Standard') as WorkoutFormat,
          formatConfig: template.defaultFormatConfig ?? null,
          notes: null,
          exercises: (template.defaultExercises ?? []).map((ex, idx) => ({
            exerciseId: crypto.randomUUID(),
            exerciseExternalId: ex.exerciseExternalId ?? '',
            exerciseName: ex.exerciseName ?? '',
            order: ex.order ?? idx + 1,
            notes: ex.notes ?? null,
            restSeconds: ex.restSeconds ?? null,
            movementType: (ex.movementType ?? 'Reps') as MovementType,
            format: (ex.format ?? null) as WorkoutFormat | null,
            formatConfig: ex.formatConfig ?? null,
            sets: (ex.sets ?? []).map((st) => ({
              setNumber: st.setNumber ?? 1,
              type: (st.type ?? 'Normal') as SetType,
              reps: st.reps ?? null,
              weightKg: st.weightKg ?? null,
              durationSeconds: st.durationSeconds ?? null,
              rpe: st.rpe ?? null,
              distanceMeters: st.distanceMeters ?? null,
              restSeconds: st.restSeconds ?? null,
            })),
          })),
        };
        return recomputeAllExercises({ ...s, workouts: [...s.workouts, newSection] });
      }),
      isDirty: true,
    });
  },

  // ── Section-scoped exercise mutations ────────────────────────────────────

  addExerciseToSection: (weekNumber, sessionId, sectionId, exercise) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => {
        const exercises = [...sec.exercises, makeNewExercise(exercise, sec.exercises.length + 1)];
        return { ...sec, exercises };
      }),
      isDirty: true,
    });
  },

  removeExerciseFromSection: (weekNumber, sessionId, sectionId, exerciseIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => ({
        ...sec,
        exercises: sec.exercises.filter((_, i) => i !== exerciseIndex).map((e, i) => ({ ...e, order: i + 1 })),
      })),
      isDirty: true,
    });
  },

  duplicateExerciseInSection: (weekNumber, sessionId, sectionId, exerciseIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => {
        const original = sec.exercises[exerciseIndex];
        if (!original) return sec;
        // A duplicate is a distinct exercise instance — give it a fresh
        // exerciseId so it doesn't share completion-state lookups with the
        // original once saved.
        const copy = { ...structuredClone(original), exerciseId: crypto.randomUUID() };
        const exercises = [...sec.exercises];
        exercises.splice(exerciseIndex + 1, 0, copy);
        return { ...sec, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
      }),
      isDirty: true,
    });
  },

  // Legacy flat-exercise mutations — delegate to first section for DnD compatibility.
  addExercise: (weekNumber, sessionId, exercise) => {
    const { plan } = get();
    if (!plan) return;
    const session = plan.weeks.find((w) => w.weekNumber === weekNumber)?.sessions.find((s) => s.sessionId === sessionId);
    const firstSectionId = session?.workouts[0]?.workoutId;
    if (!firstSectionId) return;
    get().addExerciseToSection(weekNumber, sessionId, firstSectionId, exercise);
  },

  removeExercise: (weekNumber, sessionId, exerciseIndex) => {
    const { plan } = get();
    if (!plan) return;
    // exerciseIndex is a flat index across all workouts; find the owning workout.
    const session = plan.weeks.find((w) => w.weekNumber === weekNumber)?.sessions.find((s) => s.sessionId === sessionId);
    if (!session) return;
    let remaining = exerciseIndex;
    for (const sec of session.workouts) {
      if (remaining < sec.exercises.length) {
        get().removeExerciseFromSection(weekNumber, sessionId, sec.workoutId, remaining);
        return;
      }
      remaining -= sec.exercises.length;
    }
  },

  duplicateExercise: (weekNumber, sessionId, exerciseIndex) => {
    const { plan } = get();
    if (!plan) return;
    const session = plan.weeks.find((w) => w.weekNumber === weekNumber)?.sessions.find((s) => s.sessionId === sessionId);
    if (!session) return;
    let remaining = exerciseIndex;
    for (const sec of session.workouts) {
      if (remaining < sec.exercises.length) {
        get().duplicateExerciseInSection(weekNumber, sessionId, sec.workoutId, remaining);
        return;
      }
      remaining -= sec.exercises.length;
    }
  },

  moveExerciseToSession: (weekNumber, fromSessionId, toSessionId, fromIndex, toIndex) => {
    const { plan } = get();
    if (!plan) return;
    const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) return;
    const fromSession = week.sessions.find((s) => s.sessionId === fromSessionId);
    if (!fromSession) return;
    // fromIndex is a flat index across the session's exercises view.
    const exercise = fromSession.allExercises[fromIndex];
    if (!exercise) return;

    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) =>
          w.weekNumber === weekNumber
            ? {
                ...w,
                sessions: w.sessions.map((s) => {
                  if (s.sessionId === fromSessionId) {
                    // Remove from the owning workout (find by flat index).
                    let remaining = fromIndex;
                    const workouts = s.workouts.map((sec) => {
                      if (remaining < sec.exercises.length) {
                        const exercises = sec.exercises.filter((_, i) => i !== remaining);
                        remaining = -1; // mark as found
                        return { ...sec, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
                      }
                      if (remaining >= 0) remaining -= sec.exercises.length;
                      return sec;
                    });
                    return recomputeAllExercises({ ...s, workouts });
                  }
                  if (s.sessionId === toSessionId) {
                    // Append to first workout of target session.
                    const firstSection = s.workouts[0];
                    if (!firstSection) return s;
                    const workouts = s.workouts.map((sec) => {
                      if (sec.workoutId !== firstSection.workoutId) return sec;
                      const exercises = [...sec.exercises];
                      exercises.splice(toIndex, 0, { ...exercise });
                      return { ...sec, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
                    });
                    return recomputeAllExercises({ ...s, workouts });
                  }
                  return s;
                }),
              }
            : w,
        ),
      },
      isDirty: true,
    });
  },

  addSet: (weekNumber, sessionId, sectionId, exerciseIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => ({
        ...sec,
        exercises: sec.exercises.map((e, i) => {
          if (i !== exerciseIndex) return e;
          // Carry over non-null values from the last set as defaults.
          const lastSet = e.sets[e.sets.length - 1];
          const newSet: ExerciseSet = {
            setNumber: e.sets.length + 1,
            type: 'Normal' as const,
            reps: lastSet?.reps ?? null,
            weightKg: lastSet?.weightKg ?? null,
            durationSeconds: lastSet?.durationSeconds ?? null,
            rpe: null,
            distanceMeters: lastSet?.distanceMeters ?? null,
            restSeconds: lastSet?.restSeconds ?? null,
          };
          return { ...e, sets: [...e.sets, newSet] };
        }),
      })),
      isDirty: true,
    });
  },

  removeSet: (weekNumber, sessionId, sectionId, exerciseIndex, setIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => ({
        ...sec,
        exercises: sec.exercises.map((e, i) =>
          i === exerciseIndex
            ? { ...e, sets: e.sets.filter((_, si) => si !== setIndex).map((st, si) => ({ ...st, setNumber: si + 1 })) }
            : e,
        ),
      })),
      isDirty: true,
    });
  },

  duplicateSet: (weekNumber, sessionId, sectionId, exerciseIndex, setIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => ({
        ...sec,
        exercises: sec.exercises.map((e, i) => {
          if (i !== exerciseIndex) return e;
          const source = e.sets[setIndex];
          if (!source) return e;
          const clone: ExerciseSet = { ...source };
          const next = [...e.sets.slice(0, setIndex + 1), clone, ...e.sets.slice(setIndex + 1)]
            .map((st, si) => ({ ...st, setNumber: si + 1 }));
          return { ...e, sets: next };
        }),
      })),
      isDirty: true,
    });
  },

  updateSet: (weekNumber, sessionId, sectionId, exerciseIndex, setIndex, updates) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => ({
        ...sec,
        exercises: sec.exercises.map((e, i) =>
          i === exerciseIndex
            ? { ...e, sets: e.sets.map((st, si) => (si === setIndex ? { ...st, ...updates } : st)) }
            : e,
        ),
      })),
      isDirty: true,
    });
  },

  updateExerciseNotes: (weekNumber, sessionId, sectionId, exerciseIndex, notes) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => ({
        ...sec,
        exercises: sec.exercises.map((e, i) => (i === exerciseIndex ? { ...e, notes: notes || null } : e)),
      })),
      isDirty: true,
    });
  },

  updateExerciseRestSeconds: (weekNumber, sessionId, sectionId, exerciseIndex, restSeconds) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => ({
        ...sec,
        exercises: sec.exercises.map((e, i) => (i === exerciseIndex ? { ...e, restSeconds } : e)),
      })),
      isDirty: true,
    });
  },

  updateExerciseMovementType: (weekNumber, sessionId, sectionId, exerciseIndex, movementType) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => ({
        ...sec,
        exercises: sec.exercises.map((e, i) => (i === exerciseIndex ? { ...e, movementType } : e)),
      })),
      isDirty: true,
    });
  },

  updateSessionFormat: (weekNumber, sessionId, format, formatConfig) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => ({
        ...s,
        format,
        formatConfig: formatConfig ?? null,
      })),
      isDirty: true,
    });
  },

  addWeek: () => {
    const { plan } = get();
    if (!plan) return;
    const newWeekNumber = plan.weeks.length + 1;
    set({
      plan: {
        ...plan,
        weeks: [...plan.weeks, { weekNumber: newWeekNumber, status: 'Draft' as const, sessions: [] }],
      },
      isDirty: true,
    });
  },

  moveSessionToWeek: (fromWeek, toWeek, sessionId, targetDayOfWeek, insertIndex) => {
    const { plan } = get();
    if (!plan || fromWeek === toWeek) return;
    const sourceWeek = plan.weeks.find((w) => w.weekNumber === fromWeek);
    if (!sourceWeek || sourceWeek.status === 'Published') return;
    const session = sourceWeek.sessions.find((s) => s.sessionId === sessionId);
    if (!session) return;
    const targetWeek = plan.weeks.find((w) => w.weekNumber === toWeek);
    if (!targetWeek) return;
    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) => {
          if (w.weekNumber === fromWeek) {
            return { ...w, sessions: w.sessions.filter((s) => s.sessionId !== sessionId) };
          }
          if (w.weekNumber === toWeek) {
            const existing = w.sessions
              .filter((s) => s.dayOfWeek === targetDayOfWeek)
              .sort((a, b) => a.order - b.order);
            const idx = insertIndex ?? existing.length;
            existing.splice(idx, 0, { ...session, dayOfWeek: targetDayOfWeek, order: 0 });
            const orderMap = new Map(existing.map((s, i) => [s.sessionId, i + 1]));
            const sessions = [
              ...w.sessions.filter((s) => s.dayOfWeek !== targetDayOfWeek),
              ...existing.map((s) => ({ ...s, order: orderMap.get(s.sessionId)! })),
            ];
            return { ...w, sessions };
          }
          return w;
        }),
      },
      isDirty: true,
    });
  },

  copyDayToWeek: (fromWeek, fromDay, toWeek, toDay) => {
    const { plan } = get();
    if (!plan) return;
    const sourceWeek = plan.weeks.find((w) => w.weekNumber === fromWeek);
    if (!sourceWeek) return;
    const sourceSessions = sourceWeek.sessions.filter((s) => s.dayOfWeek === fromDay);
    if (sourceSessions.length === 0) return;
    const targetWeekObj = plan.weeks.find((w) => w.weekNumber === toWeek);
    const existingCount = targetWeekObj?.sessions.filter((s) => s.dayOfWeek === toDay).length ?? 0;
    const copiedSessions = sourceSessions.map((s, i) => ({
      ...structuredClone(s),
      sessionId: crypto.randomUUID(),
      dayOfWeek: toDay,
      order: existingCount + i + 1,
    }));
    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) =>
          w.weekNumber === toWeek
            ? {
                ...w,
                sessions: [
                  ...w.sessions,
                  ...copiedSessions,
                ],
              }
            : w,
        ),
      },
      isDirty: true,
    });
  },

  updateDayNote: (weekNumber, dayOfWeek, note) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) =>
          w.weekNumber === weekNumber
            ? {
                ...w,
                dayNotes: {
                  ...(w.dayNotes ?? {}),
                  [dayOfWeek]: note,
                },
              }
            : w,
        ),
      },
      isDirty: true,
    });
  },

  swapDays: (weekNumber, dayA, dayB) => {
    const { plan } = get();
    if (!plan || dayA === dayB) return;
    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) =>
          w.weekNumber === weekNumber
            ? {
                ...w,
                sessions: w.sessions.map((s) =>
                  s.dayOfWeek === dayA
                    ? { ...s, dayOfWeek: dayB }
                    : s.dayOfWeek === dayB
                      ? { ...s, dayOfWeek: dayA }
                      : s,
                ),
              }
            : w,
        ),
      },
      isDirty: true,
    });
  },

  copyDayToDay: (weekNumber, fromDay, toDay) => {
    const { plan } = get();
    if (!plan || fromDay === toDay) return;
    const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) return;
    const sourceSessions = week.sessions.filter((s) => s.dayOfWeek === fromDay);
    const existingCount = week.sessions.filter((s) => s.dayOfWeek === toDay).length;
    const copiedSessions = sourceSessions.map((s, i) => ({
      ...structuredClone(s),
      sessionId: crypto.randomUUID(),
      dayOfWeek: toDay,
      order: existingCount + i + 1,
    }));
    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) =>
          w.weekNumber === weekNumber
            ? {
                ...w,
                sessions: [
                  ...w.sessions,
                  ...copiedSessions,
                ],
              }
            : w,
        ),
      },
      isDirty: true,
    });
  },

  reorderDay: (weekNumber, fromDay, toPosition) => {
    const { plan } = get();
    if (!plan || fromDay === toPosition) return;
    // Build ordered array of days [1..7], remove fromDay, insert at toPosition
    const order = [1, 2, 3, 4, 5, 6, 7];
    const fromIdx = order.indexOf(fromDay);
    order.splice(fromIdx, 1);
    // toPosition is the day-of-week BEFORE which we insert (or 8 for end)
    const insertIdx = toPosition > fromDay ? toPosition - 2 : toPosition - 1;
    order.splice(Math.max(0, Math.min(order.length, insertIdx)), 0, fromDay);
    // order now maps: new visual position → old dayOfWeek
    // We need: old dayOfWeek → new dayOfWeek (which is position+1 in the array)
    const dayMapping = new Map<number, number>();
    order.forEach((oldDay, idx) => dayMapping.set(oldDay, idx + 1));
    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) =>
          w.weekNumber === weekNumber
            ? {
                ...w,
                sessions: w.sessions.map((s) => ({
                  ...s,
                  dayOfWeek: dayMapping.get(s.dayOfWeek) ?? s.dayOfWeek,
                })),
              }
            : w,
        ),
      },
      isDirty: true,
    });
  },

  removeWeek: (weekNumber) => {
    const { plan } = get();
    if (!plan) return;
    const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
    if (!week || week.status === 'Published') return;
    set({
      plan: {
        ...plan,
        weeks: plan.weeks
          .filter((w) => w.weekNumber !== weekNumber)
          .map((w, i) => ({ ...w, weekNumber: i + 1 })),
      },
      isDirty: true,
      selectedWeek: Math.min(get().selectedWeek, plan.weeks.length - 1),
    });
  },

  save: async () => {
    const { plan } = get();
    if (!plan) return;

    // Pre-save validation — surface field-level issues with toast lines and
    // mark the offending IDs so cards can highlight themselves.
    const issues: string[] = [];
    const invalidIds = new Set<string>();
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        if (!s.name?.trim()) {
          invalidIds.add(s.sessionId);
          issues.push(
            i18n.t('training.validation.sessionMissingName', { week: w.weekNumber }),
          );
        }
        for (const sec of s.workouts) {
          if (!sec.name?.trim()) {
            invalidIds.add(sec.workoutId);
            issues.push(
              i18n.t('training.validation.workoutMissingName', {
                session: s.name?.trim() || i18n.t('training.untitledSession'),
              }),
            );
          }
          // ForTime sections legitimately have no exercises (the workout IS the time cap).
          if (sec.format !== 'ForTime' && sec.exercises.length === 0) {
            invalidIds.add(sec.workoutId);
            issues.push(
              i18n.t('training.validation.workoutNoExercises', {
                workout: sec.name?.trim() || i18n.t('training.untitledWorkout'),
              }),
            );
          }

          // Per-exercise/set requirements per format:
          //   Standard          → every set needs reps + rest (weight stays optional)
          //   EMOM / AMRAP / ForTime → first set needs reps
          //   Tabata            → no required fields
          for (const ex of sec.exercises) {
            const workoutLabel = sec.name?.trim() || i18n.t('training.untitledWorkout');
            const exerciseLabel = ex.exerciseName || i18n.t('training.unnamedExercise');
            if (ex.sets.length === 0) {
              invalidIds.add(sec.workoutId);
              issues.push(
                i18n.t('training.validation.exerciseNoSets', {
                  workout: workoutLabel,
                  exercise: exerciseLabel,
                }),
              );
              continue;
            }
            if (sec.format === 'Standard') {
              const allFilled = ex.sets.every(
                (st) => st.reps != null && st.restSeconds != null,
              );
              if (!allFilled) {
                invalidIds.add(sec.workoutId);
                issues.push(
                  i18n.t('training.validation.exerciseSetMissing', {
                    workout: workoutLabel,
                    exercise: exerciseLabel,
                  }),
                );
              }
            } else if (sec.format !== 'Tabata') {
              // EMOM / AMRAP / ForTime — first set's prescription field
              // required, and which field that is depends on the
              // exercise's movement type:
              //   Reps / RepsForTime / undefined → reps
              //   Time                           → durationSeconds
              //   Distance                       → distanceMeters
              // Weight is always optional regardless of movement type.
              const firstSet = ex.sets[0];
              const mt = ex.movementType;
              let missing = false;
              let missingKey = 'training.validation.exerciseRepsMissing';
              if (mt === 'Time') {
                missing = firstSet.durationSeconds == null;
                missingKey = 'training.validation.exerciseDurationMissing';
              } else if (mt === 'Distance') {
                missing = firstSet.distanceMeters == null;
                missingKey = 'training.validation.exerciseDistanceMissing';
              } else {
                // Reps / RepsForTime / null / undefined
                missing = firstSet.reps == null;
              }
              if (missing) {
                invalidIds.add(sec.workoutId);
                issues.push(
                  i18n.t(missingKey, {
                    workout: workoutLabel,
                    exercise: exerciseLabel,
                  }),
                );
              }
            }
          }
        }
      }
    }
    if (issues.length > 0) {
      set({ invalidIds });
      const headline = i18n.t('training.validation.headline');
      // Show up to 5 distinct lines so the toast doesn't grow indefinitely.
      const lines = Array.from(new Set(issues)).slice(0, 5);
      const more = issues.length > lines.length
        ? '\n' + i18n.t('training.validation.andMore', { count: issues.length - lines.length })
        : '';
      useToastStore.getState().addToast(`${headline}\n${lines.join('\n')}${more}`, 'error');
      return;
    }
    set({ invalidIds: new Set(), isSaving: true });
    try {
      // Round-trip exerciseId — UpdateSessionExerciseRequest.ExerciseId is
      // Guid?, documented "new GUID generated if null"; omitting it re-mints
      // every instance id server-side and orphans the client's exercise-level
      // completion state keyed by the old id.
      const toUpdateExercise = (e: SessionExercise): UpdateSessionExerciseRequest => ({
        exerciseId: e.exerciseId,
        exerciseExternalId: e.exerciseExternalId,
        exerciseName: e.exerciseName,
        order: e.order,
        notes: e.notes,
        restSeconds: e.restSeconds,
        movementType: e.movementType,
        // Per-exercise format override is removed from the editor; always null on save.
        format: null,
        formatConfig: null,
        sets: e.sets.map((st) => ({
          setNumber: st.setNumber,
          type: st.type,
          reps: st.reps,
          weightKg: st.weightKg,
          durationSeconds: st.durationSeconds,
          rpe: st.rpe,
          distanceMeters: st.distanceMeters,
          restSeconds: st.restSeconds,
        })),
      });

      const request: UpdateTrainingPlanRequest = {
        name: plan.name,
        description: plan.description,
        version: plan.version,
        startDate: plan.startDate,
        weeks: plan.weeks.map((w) => ({
          weekNumber: w.weekNumber,
          dayNotes: w.dayNotes,
          sessions: w.sessions.map((s) => ({
            sessionId: s.sessionId,
            dayOfWeek: s.dayOfWeek,
            name: s.name,
            order: s.order,
            notes: s.notes,
            format: s.format,
            formatConfig: s.formatConfig,
            // Emit real workouts — each with its stable workoutId.
            workouts: s.workouts.map((sec): UpdateWorkoutRequest => ({
              workoutId: sec.workoutId,
              order: sec.order,
              name: sec.name,
              format: sec.format,
              formatConfig: sec.formatConfig,
              notes: sec.notes,
              exercises: sec.exercises.map(toUpdateExercise),
            })),
            // `standaloneExercises` is round-tripped verbatim — the editor
            // has no affordance to create loose exercises, but any that
            // arrived on load (e.g. from the mobile client) must not be
            // dropped or duplicated into `workouts`. NEVER derived from
            // `allExercises` — that computed union already includes every
            // workout's nested exercises, and sending it back here would
            // persist them a second time, compounding on every save.
            standaloneExercises: s.standaloneExercises.map(toUpdateExercise),
          })),
        })),
      };

      const updated = await updateTrainingPlan(plan.planId, request);
      // Re-run setPlan so sections are normalized (same as initial load).
      get().setPlan(updated);
      set({ sessionLockedError: null });
      showSuccess('training.saved');
    } catch (err) {
      // 409 session_locked: derive blocked session IDs UI-side as published
      // sessions that have changes but are NOT in Editing state.
      // The 409 ProblemDetails carries the code in `extensions.errorCode`
      // (camelCase) — NOT in `errors[0].reason` (the FastEndpoints validation
      // shape). We read `response.data.errorCode` directly.
      // The 409 ProblemDetails carries the code in extensions.errorCode (camelCase),
      // read via the typed RFC-7807 helper — NOT getErrorCode() which reads the
      // FastEndpoints errors[].reason validation shape.
      const errorCode = getRfc7807ErrorCode(err);

      if (errorCode === 'SECTION_ALREADY_COMPLETED') {
        // 409 SECTION_ALREADY_COMPLETED: the coach tried to save changes to a section
        // the client has already finished via the per-section completion path (#465).
        // Surface as an error toast — the translated message explains what happened.
        // The client-side locked affordance (isSectionLocked / isSectionFinishedByClient)
        // should have prevented the edit in most cases; this is the server-side guard.
        // After showing the toast, trigger a plan refresh so the UI shows the current
        // finished state (in case the section finished after the page was loaded).
        useToastStore.getState().addToast(i18n.t('apiErrors.SECTION_ALREADY_COMPLETED'), 'error');
        // Refresh completions so the finished badge appears immediately and the coach
        // can see which section is now locked without a full page reload.
        void get().refreshCompletions();
      } else if (errorCode === 'session_locked') {
        const { sessionLockMap, originalPlan } = get();
        // A session is "blocking the save" when it is published AND the trainer
        // has changed it AND it is not currently in Editing state (i.e. the
        // lock was not held by the trainer during the update attempt).
        const blockedSessionIds: string[] = [];
        if (originalPlan) {
          for (const week of plan.weeks) {
            const origWeek = originalPlan.weeks.find(
              (w) => w.weekNumber === week.weekNumber,
            );
            if (!origWeek || origWeek.status !== 'Published') continue;
            for (const session of week.sessions) {
              const origSession = origWeek.sessions.find(
                (s) => s.sessionId === session.sessionId,
              );
              // Session is modified when its JSON differs from the original.
              const isModified =
                JSON.stringify(session) !== JSON.stringify(origSession);
              if (!isModified) continue;
              const lockEntry = sessionLockMap.get(session.sessionId);
              const isEditing = lockEntry?.lockState === 'Editing';
              if (!isEditing) {
                blockedSessionIds.push(session.sessionId);
              }
            }
          }
        }
        set({ sessionLockedError: blockedSessionIds.length > 0 ? blockedSessionIds : ['unknown'] });
        // Show a brief toast to draw attention; inline error has more detail.
        useToastStore.getState().addToast(i18n.t('apiErrors.session_locked'), 'error');
      } else {
        showApiError(err, 'training.saveError');
      }
    } finally {
      set({ isSaving: false });
    }
  },

  setStartDate: (date) => {
    const { plan } = get();
    if (!plan) return;
    set({ plan: { ...plan, startDate: date }, isDirty: true });
  },

  publishWeek: async (weekNumber) => {
    const { plan } = get();
    if (!plan) return;

    set({ isSaving: true });
    try {
      const updated = await publishTrainingWeek(plan.planId, weekNumber, plan.version);
      get().setPlan(updated);
      showSuccess('training.weekPublished');
    } catch (err) {
      showApiError(err, 'training.publishError');
    } finally {
      set({ isSaving: false });
    }
  },

  refreshCompletions: async () => {
    const { plan } = get();
    if (!plan) return;
    try {
      const fresh = await getTrainingPlan(plan.planId);
      const completions = fresh.completions ?? [];
      // Also pick up the fresh sessionLockStates so lock state stays current
      // after a SignalR sessioneditlockchanged event that triggers this path.
      const sessionLockStates = fresh.sessionLockStates ?? [];
      const sessionLockMap = buildLockMap(sessionLockStates);
      // Also carry fresh sessionExecutions so isSessionFinished badges update
      // live without a full page reload. The unlock affordance gates on
      // sessionExec.isSessionFinished, so this is required for AC1/AC4 of #429.
      const sessionExecutions = fresh.sessionExecutions ?? [];
      set((state) => ({
        // Keep plan.sessionLockStates in lockstep with sessionLockMap so the
        // in-memory plan can't diverge from the authoritative live lock state.
        plan: state.plan
          ? { ...state.plan, completions, sessionLockStates, sessionExecutions }
          : state.plan,
        // originalPlan tracks server-state too, so it must move with the
        // freshly fetched completions — otherwise revert() would surface
        // stale completion data.
        originalPlan: state.originalPlan
          ? { ...state.originalPlan, completions, sessionLockStates, sessionExecutions }
          : state.originalPlan,
        sessionLockMap,
      }));
    } catch {
      // Non-critical — UI will catch up on the next manual save / load.
    }
  },
}));

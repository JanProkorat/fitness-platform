import { create } from 'zustand';
import type {
  TrainingPlanDetail,
  TrainingSection,
  TrainingSession,
  SessionExercise,
  ExerciseSet,
  UpdateTrainingPlanRequest,
  UpdateSectionRequest,
  WorkoutFormat,
  MovementType,
  SetType,
  WodConfig,
} from '@/api/training-plan-types';
import type { SectionTemplateResponse } from '@/api/sectionTemplates';
import { updateTrainingPlan, publishTrainingWeek } from '@/api/training-plans';
import { showApiError, showSuccess } from '@/lib/api-errors';

interface TrainingPlanState {
  plan: TrainingPlanDetail | null;
  originalPlan: TrainingPlanDetail | null;
  isDirty: boolean;
  isSaving: boolean;
  selectedWeek: number;

  setPlan: (plan: TrainingPlanDetail) => void;
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
  updateSection: (weekNumber: number, sessionId: string, sectionId: string, patch: Partial<Pick<TrainingSection, 'name' | 'format' | 'formatConfig' | 'notes'>>) => void;
  reorderSections: (weekNumber: number, sessionId: string, fromIdx: number, toIdx: number) => void;
  addSectionFromTemplate: (weekNumber: number, sessionId: string, template: SectionTemplateResponse) => void;

  // Exercise mutations (now scoped to section)
  addExerciseToSection: (weekNumber: number, sessionId: string, sectionId: string, exercise: { exerciseExternalId: string; exerciseName: string }) => void;
  removeExerciseFromSection: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number) => void;
  duplicateExerciseInSection: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number) => void;
  reorderExercisesInSection: (weekNumber: number, sessionId: string, sectionId: string, fromIndex: number, toIndex: number) => void;
  reorderExercisesInSectionByIds: (weekNumber: number, sessionId: string, sectionId: string, orderedIds: string[]) => void;

  // Legacy exercise mutations (kept for DnD cross-session moves — operate on the first section)
  addExercise: (weekNumber: number, sessionId: string, exercise: { exerciseExternalId: string; exerciseName: string }) => void;
  removeExercise: (weekNumber: number, sessionId: string, exerciseIndex: number) => void;
  duplicateExercise: (weekNumber: number, sessionId: string, exerciseIndex: number) => void;
  reorderExercises: (weekNumber: number, sessionId: string, fromIndex: number, toIndex: number) => void;
  reorderExercisesByIds: (weekNumber: number, sessionId: string, orderedIds: string[]) => void;
  moveExerciseToSession: (weekNumber: number, fromSessionId: string, toSessionId: string, fromIndex: number, toIndex: number) => void;

  // Set mutations (section-scoped)
  addSet: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number) => void;
  removeSet: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, setIndex: number) => void;
  updateSet: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, setIndex: number, updates: Partial<ExerciseSet>) => void;

  // Exercise field mutations (section-scoped)
  updateExerciseNotes: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, notes: string) => void;
  updateExerciseRestSeconds: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, restSeconds: number | null) => void;
  updateExerciseMovementType: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, movementType: MovementType) => void;
  updateExerciseFormat: (weekNumber: number, sessionId: string, sectionId: string, exerciseIndex: number, format: WorkoutFormat | null, formatConfig?: WodConfig | null) => void;

  // Session format mutations (session-level inheritable default)
  updateSessionFormat: (weekNumber: number, sessionId: string, format: WorkoutFormat, formatConfig?: WodConfig | null) => void;

  // Cross-week mutations
  moveSessionToWeek: (fromWeek: number, toWeek: number, sessionId: string, targetDayOfWeek: number, insertIndex?: number) => void;
  moveExerciseToWeek: (fromWeek: number, toWeek: number, fromSessionId: string, toSessionId: string, fromIndex: number, toIndex: number) => void;
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

/** Patch a specific section within a session; also recomputes the flat exercises view. */
function patchSection(
  plan: TrainingPlanDetail,
  weekNumber: number,
  sessionId: string,
  sectionId: string,
  updater: (section: TrainingSection) => TrainingSection,
): TrainingPlanDetail {
  return updateSession(plan, weekNumber, sessionId, (s) => {
    const sections = s.sections.map((sec) =>
      sec.sectionId === sectionId ? updater(sec) : sec,
    );
    return { ...s, sections, exercises: sections.flatMap((sec) => sec.exercises) };
  });
}

/** Create a default single-set exercise from a search result. */
function makeNewExercise(exercise: { exerciseExternalId: string; exerciseName: string }, order: number): SessionExercise {
  return {
    ...exercise,
    order,
    movementType: 'Reps' as const,
    format: null,
    formatConfig: null,
    notes: null,
    restSeconds: null,
    sets: [{ setNumber: 1, type: 'Normal' as const, reps: null, weightKg: null, durationSeconds: null, rpe: null, distanceMeters: null, restSeconds: null }],
  };
}

export const useTrainingPlanStore = create<TrainingPlanState>((set, get) => ({
  plan: null,
  originalPlan: null,
  isDirty: false,
  isSaving: false,
  selectedWeek: 1,

  setPlan: (rawPlan) => {
    // Normalize exercises helper — fills in defaults for pre-sections legacy exercises.
    const normalizeExercise = (e: SessionExercise): SessionExercise => ({
      ...e,
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

    const plan: TrainingPlanDetail = {
      ...rawPlan,
      weeks: rawPlan.weeks.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) => {
          const sessionFormat = (s.format ?? 'Standard') as WorkoutFormat;

          // If the API returned sections, use them directly.
          const rawSections = (s as TrainingSession & { sections?: unknown[] }).sections;
          // Cast through unknown to avoid TS complaints — generated type has sections?: TrainingSection[]
          const apiSections = rawSections as Array<{
            sectionId?: string;
            order?: number;
            name?: string;
            format?: WorkoutFormat;
            formatConfig?: WodConfig | null;
            notes?: string | null;
            exercises?: SessionExercise[];
          }> | undefined;

          let sections: TrainingSection[];

          if (apiSections && apiSections.length > 0) {
            // Post-#244 response: map API sections directly.
            sections = apiSections.map((sec, idx) => ({
              sectionId: sec.sectionId ?? crypto.randomUUID(),
              order: sec.order ?? idx,
              name: sec.name ?? 'Sekce',
              format: (sec.format ?? sessionFormat) as WorkoutFormat,
              formatConfig: sec.formatConfig ?? null,
              notes: sec.notes ?? null,
              exercises: (sec.exercises ?? []).map(normalizeExercise),
            }));
          } else {
            // Legacy flat exercises — synthesize one default section.
            const flatExercises = (s.exercises ?? []).map(normalizeExercise);
            sections = [
              {
                sectionId: crypto.randomUUID(),
                order: 0,
                name: 'Hlavní',
                format: sessionFormat,
                formatConfig: s.formatConfig ?? null,
                notes: null,
                exercises: flatExercises,
              },
            ];
          }

          return {
            ...s,
            format: sessionFormat,
            formatConfig: s.formatConfig ?? null,
            sections,
            // Keep a flat exercises view derived from all sections for the header
            // exercise count. This is recomputed each time sections change.
            exercises: sections.flatMap((sec) => sec.exercises),
          };
        }),
      })),
    };
    set({ plan, originalPlan: structuredClone(plan), isDirty: false, selectedWeek: 1 });
  },
  setSelectedWeek: (week) => set({ selectedWeek: week }),
  revert: () => {
    const { originalPlan } = get();
    if (!originalPlan) return;
    set({ plan: structuredClone(originalPlan), isDirty: false });
  },

  addSession: (weekNumber, dayOfWeek, name) => {
    const { plan } = get();
    if (!plan) return;
    const defaultSection: TrainingSection = {
      sectionId: crypto.randomUUID(),
      order: 0,
      name: 'Hlavní',
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
      sections: [defaultSection],
      exercises: [],
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
        const newSection: TrainingSection = {
          sectionId: crypto.randomUUID(),
          order: s.sections.length,
          name: '',
          format,
          formatConfig: null,
          notes: null,
          exercises: [],
        };
        const sections = [...s.sections, newSection];
        return { ...s, sections, exercises: sections.flatMap((sec) => sec.exercises) };
      }),
      isDirty: true,
    });
  },

  removeSection: (weekNumber, sessionId, sectionId) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => {
        const sections = s.sections
          .filter((sec) => sec.sectionId !== sectionId)
          .map((sec, i) => ({ ...sec, order: i }));
        return { ...s, sections, exercises: sections.flatMap((sec) => sec.exercises) };
      }),
      isDirty: true,
    });
  },

  updateSection: (weekNumber, sessionId, sectionId, patch) => {
    const { plan } = get();
    if (!plan) return;
    set({ plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => ({ ...sec, ...patch })), isDirty: true });
  },

  reorderSections: (weekNumber, sessionId, fromIdx, toIdx) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => {
        const sections = [...s.sections];
        const [moved] = sections.splice(fromIdx, 1);
        sections.splice(toIdx, 0, moved);
        const reordered = sections.map((sec, i) => ({ ...sec, order: i }));
        return { ...s, sections: reordered, exercises: reordered.flatMap((sec) => sec.exercises) };
      }),
      isDirty: true,
    });
  },

  addSectionFromTemplate: (weekNumber, sessionId, template) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => {
        const newSection: TrainingSection = {
          sectionId: crypto.randomUUID(),
          order: s.sections.length,
          name: template.name ?? '',
          format: (template.defaultFormat ?? 'Standard') as WorkoutFormat,
          formatConfig: template.defaultFormatConfig ?? null,
          notes: null,
          exercises: (template.defaultExercises ?? []).map((ex, idx) => ({
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
        const sections = [...s.sections, newSection];
        return { ...s, sections, exercises: sections.flatMap((sec) => sec.exercises) };
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
        const copy = structuredClone(original);
        const exercises = [...sec.exercises];
        exercises.splice(exerciseIndex + 1, 0, copy);
        return { ...sec, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
      }),
      isDirty: true,
    });
  },

  reorderExercisesInSection: (weekNumber, sessionId, sectionId, fromIndex, toIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => {
        const exercises = [...sec.exercises];
        const [moved] = exercises.splice(fromIndex, 1);
        exercises.splice(toIndex, 0, moved);
        return { ...sec, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
      }),
      isDirty: true,
    });
  },

  reorderExercisesInSectionByIds: (weekNumber, sessionId, sectionId, orderedIds) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => {
        const byId = new Map(sec.exercises.map((e, i) => [`${e.exerciseExternalId}-${i}`, e]));
        const reordered = orderedIds.map((id) => byId.get(id)).filter((e): e is SessionExercise => e !== undefined);
        return { ...sec, exercises: reordered.map((e, i) => ({ ...e, order: i + 1 })) };
      }),
      isDirty: true,
    });
  },

  // Legacy flat-exercise mutations — delegate to first section for DnD compatibility.
  addExercise: (weekNumber, sessionId, exercise) => {
    const { plan } = get();
    if (!plan) return;
    const session = plan.weeks.find((w) => w.weekNumber === weekNumber)?.sessions.find((s) => s.sessionId === sessionId);
    const firstSectionId = session?.sections[0]?.sectionId;
    if (!firstSectionId) return;
    get().addExerciseToSection(weekNumber, sessionId, firstSectionId, exercise);
  },

  removeExercise: (weekNumber, sessionId, exerciseIndex) => {
    const { plan } = get();
    if (!plan) return;
    // exerciseIndex is a flat index across all sections; find the owning section.
    const session = plan.weeks.find((w) => w.weekNumber === weekNumber)?.sessions.find((s) => s.sessionId === sessionId);
    if (!session) return;
    let remaining = exerciseIndex;
    for (const sec of session.sections) {
      if (remaining < sec.exercises.length) {
        get().removeExerciseFromSection(weekNumber, sessionId, sec.sectionId, remaining);
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
    for (const sec of session.sections) {
      if (remaining < sec.exercises.length) {
        get().duplicateExerciseInSection(weekNumber, sessionId, sec.sectionId, remaining);
        return;
      }
      remaining -= sec.exercises.length;
    }
  },

  reorderExercises: (weekNumber, sessionId, fromIndex, toIndex) => {
    // Legacy: assumes single-section (operates on flat index of first section only).
    const { plan } = get();
    if (!plan) return;
    const session = plan.weeks.find((w) => w.weekNumber === weekNumber)?.sessions.find((s) => s.sessionId === sessionId);
    const firstSectionId = session?.sections[0]?.sectionId;
    if (!firstSectionId) return;
    get().reorderExercisesInSection(weekNumber, sessionId, firstSectionId, fromIndex, toIndex);
  },

  reorderExercisesByIds: (weekNumber, sessionId, orderedIds) => {
    const { plan } = get();
    if (!plan) return;
    const session = plan.weeks.find((w) => w.weekNumber === weekNumber)?.sessions.find((s) => s.sessionId === sessionId);
    const firstSectionId = session?.sections[0]?.sectionId;
    if (!firstSectionId) return;
    get().reorderExercisesInSectionByIds(weekNumber, sessionId, firstSectionId, orderedIds);
  },

  moveExerciseToSession: (weekNumber, fromSessionId, toSessionId, fromIndex, toIndex) => {
    const { plan } = get();
    if (!plan) return;
    const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) return;
    const fromSession = week.sessions.find((s) => s.sessionId === fromSessionId);
    if (!fromSession) return;
    // fromIndex is a flat index across the session's exercises view.
    const exercise = fromSession.exercises[fromIndex];
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
                    // Remove from the owning section (find by flat index).
                    let remaining = fromIndex;
                    const sections = s.sections.map((sec) => {
                      if (remaining < sec.exercises.length) {
                        const exercises = sec.exercises.filter((_, i) => i !== remaining);
                        remaining = -1; // mark as found
                        return { ...sec, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
                      }
                      if (remaining >= 0) remaining -= sec.exercises.length;
                      return sec;
                    });
                    return { ...s, sections, exercises: sections.flatMap((sec) => sec.exercises) };
                  }
                  if (s.sessionId === toSessionId) {
                    // Append to first section of target session.
                    const firstSection = s.sections[0];
                    if (!firstSection) return s;
                    const sections = s.sections.map((sec) => {
                      if (sec.sectionId !== firstSection.sectionId) return sec;
                      const exercises = [...sec.exercises];
                      exercises.splice(toIndex, 0, { ...exercise });
                      return { ...sec, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
                    });
                    return { ...s, sections, exercises: sections.flatMap((sec) => sec.exercises) };
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

  updateExerciseFormat: (weekNumber, sessionId, sectionId, exerciseIndex, format, formatConfig) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: patchSection(plan, weekNumber, sessionId, sectionId, (sec) => ({
        ...sec,
        exercises: sec.exercises.map((e, i) =>
          i === exerciseIndex
            ? { ...e, format: format ?? null, formatConfig: formatConfig ?? null }
            : e,
        ),
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

  moveExerciseToWeek: (fromWeek, toWeek, fromSessionId, toSessionId, fromIndex, toIndex) => {
    const { plan } = get();
    if (!plan || fromWeek === toWeek) {
      // Same week — delegate to existing action
      if (fromSessionId === toSessionId) {
        get().reorderExercises(fromWeek, fromSessionId, fromIndex, toIndex);
      } else {
        get().moveExerciseToSession(fromWeek, fromSessionId, toSessionId, fromIndex, toIndex);
      }
      return;
    }
    const sourceWeek = plan.weeks.find((w) => w.weekNumber === fromWeek);
    const targetWeek = plan.weeks.find((w) => w.weekNumber === toWeek);
    if (!sourceWeek || !targetWeek) return;
    const fromSession = sourceWeek.sessions.find((s) => s.sessionId === fromSessionId);
    if (!fromSession) return;
    const exercise = fromSession.exercises[fromIndex];
    if (!exercise) return;

    set({
      plan: {
        ...plan,
        weeks: plan.weeks.map((w) => {
          if (w.weekNumber === fromWeek) {
            return {
              ...w,
              sessions: w.sessions.map((s) => {
                if (s.sessionId !== fromSessionId) return s;
                let remaining = fromIndex;
                const sections = s.sections.map((sec) => {
                  if (remaining >= 0 && remaining < sec.exercises.length) {
                    const exercises = sec.exercises.filter((_, i) => i !== remaining);
                    remaining = -1;
                    return { ...sec, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
                  }
                  if (remaining >= 0) remaining -= sec.exercises.length;
                  return sec;
                });
                return { ...s, sections, exercises: sections.flatMap((sec) => sec.exercises) };
              }),
            };
          }
          if (w.weekNumber === toWeek) {
            return {
              ...w,
              sessions: w.sessions.map((s) => {
                if (s.sessionId !== toSessionId) return s;
                const firstSection = s.sections[0];
                if (!firstSection) return s;
                const sections = s.sections.map((sec) => {
                  if (sec.sectionId !== firstSection.sectionId) return sec;
                  const exercises = [...sec.exercises];
                  exercises.splice(toIndex, 0, { ...exercise });
                  return { ...sec, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
                });
                return { ...s, sections, exercises: sections.flatMap((sec) => sec.exercises) };
              }),
            };
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

    set({ isSaving: true });
    try {
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
            // Emit real sections — each with its stable sectionId.
            sections: s.sections.map((sec): UpdateSectionRequest => ({
              sectionId: sec.sectionId,
              order: sec.order,
              name: sec.name,
              format: sec.format,
              formatConfig: sec.formatConfig,
              exercises: sec.exercises.map((e) => ({
                exerciseExternalId: e.exerciseExternalId,
                exerciseName: e.exerciseName,
                order: e.order,
                notes: e.notes,
                restSeconds: e.restSeconds,
                movementType: e.movementType,
                format: e.format,
                formatConfig: e.formatConfig,
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
              })),
            })),
          })),
        })),
      };

      const updated = await updateTrainingPlan(plan.planId, request);
      // Re-run setPlan so sections are normalized (same as initial load).
      get().setPlan(updated);
      showSuccess('training.saved');
    } catch (err) {
      showApiError(err, 'training.saveError');
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
}));

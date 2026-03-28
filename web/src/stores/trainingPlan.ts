import { create } from 'zustand';
import type {
  TrainingPlanDetail,
  TrainingSession,
  ExerciseSet,
  UpdateTrainingPlanRequest,
} from '@/api/training-plan-types';
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

  // Exercise mutations
  addExercise: (weekNumber: number, sessionId: string, exercise: { exerciseExternalId: string; exerciseName: string }) => void;
  removeExercise: (weekNumber: number, sessionId: string, exerciseIndex: number) => void;
  duplicateExercise: (weekNumber: number, sessionId: string, exerciseIndex: number) => void;
  reorderExercises: (weekNumber: number, sessionId: string, fromIndex: number, toIndex: number) => void;
  reorderExercisesByIds: (weekNumber: number, sessionId: string, orderedIds: string[]) => void;
  moveExerciseToSession: (weekNumber: number, fromSessionId: string, toSessionId: string, fromIndex: number, toIndex: number) => void;

  // Set mutations
  addSet: (weekNumber: number, sessionId: string, exerciseIndex: number) => void;
  removeSet: (weekNumber: number, sessionId: string, exerciseIndex: number, setIndex: number) => void;
  updateSet: (weekNumber: number, sessionId: string, exerciseIndex: number, setIndex: number, updates: Partial<ExerciseSet>) => void;

  // Exercise field mutations
  updateExerciseNotes: (weekNumber: number, sessionId: string, exerciseIndex: number, notes: string) => void;
  updateExerciseRestSeconds: (weekNumber: number, sessionId: string, exerciseIndex: number, restSeconds: number | null) => void;

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

export const useTrainingPlanStore = create<TrainingPlanState>((set, get) => ({
  plan: null,
  originalPlan: null,
  isDirty: false,
  isSaving: false,
  selectedWeek: 1,

  setPlan: (plan) => set({ plan, originalPlan: structuredClone(plan), isDirty: false, selectedWeek: 1 }),
  setSelectedWeek: (week) => set({ selectedWeek: week }),
  revert: () => {
    const { originalPlan } = get();
    if (!originalPlan) return;
    set({ plan: structuredClone(originalPlan), isDirty: false });
  },

  addSession: (weekNumber, dayOfWeek, name) => {
    const { plan } = get();
    if (!plan) return;
    const newSession: TrainingSession = {
      sessionId: crypto.randomUUID(),
      dayOfWeek,
      name,
      order: 1,
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

  addExercise: (weekNumber, sessionId, exercise) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => ({
        ...s,
        exercises: [
          ...s.exercises,
          {
            ...exercise,
            order: s.exercises.length + 1,
            sets: [{ setNumber: 1, type: 'Normal' as const, reps: null, weightKg: null, durationSeconds: null, rpe: null, distanceMeters: null }],
          },
        ],
      })),
      isDirty: true,
    });
  },

  removeExercise: (weekNumber, sessionId, exerciseIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => ({
        ...s,
        exercises: s.exercises.filter((_, i) => i !== exerciseIndex).map((e, i) => ({ ...e, order: i + 1 })),
      })),
      isDirty: true,
    });
  },

  duplicateExercise: (weekNumber, sessionId, exerciseIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => {
        const original = s.exercises[exerciseIndex];
        if (!original) return s;
        const copy = structuredClone(original);
        const exercises = [...s.exercises];
        exercises.splice(exerciseIndex + 1, 0, copy);
        return { ...s, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
      }),
      isDirty: true,
    });
  },

  reorderExercises: (weekNumber, sessionId, fromIndex, toIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => {
        const exercises = [...s.exercises];
        const [moved] = exercises.splice(fromIndex, 1);
        exercises.splice(toIndex, 0, moved);
        return { ...s, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
      }),
      isDirty: true,
    });
  },

  reorderExercisesByIds: (weekNumber, sessionId, orderedIds) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => {
        const byId = new Map(s.exercises.map((e, i) => [`${e.exerciseExternalId}-${i}`, e]));
        const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as typeof s.exercises;
        return { ...s, exercises: reordered.map((e, i) => ({ ...e, order: i + 1 })) };
      }),
      isDirty: true,
    });
  },

  moveExerciseToSession: (weekNumber, fromSessionId, toSessionId, fromIndex, toIndex) => {
    const { plan } = get();
    if (!plan) return;
    const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) return;
    const fromSession = week.sessions.find((s) => s.sessionId === fromSessionId);
    if (!fromSession) return;
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
                    const exercises = s.exercises.filter((_, i) => i !== fromIndex);
                    return { ...s, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
                  }
                  if (s.sessionId === toSessionId) {
                    const exercises = [...s.exercises];
                    exercises.splice(toIndex, 0, { ...exercise });
                    return { ...s, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
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

  addSet: (weekNumber, sessionId, exerciseIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => ({
        ...s,
        exercises: s.exercises.map((e, i) =>
          i === exerciseIndex
            ? { ...e, sets: [...e.sets, { setNumber: e.sets.length + 1, type: 'Normal' as const, reps: null, weightKg: null, durationSeconds: null, rpe: null, distanceMeters: null }] }
            : e,
        ),
      })),
      isDirty: true,
    });
  },

  removeSet: (weekNumber, sessionId, exerciseIndex, setIndex) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => ({
        ...s,
        exercises: s.exercises.map((e, i) =>
          i === exerciseIndex
            ? { ...e, sets: e.sets.filter((_, si) => si !== setIndex).map((st, si) => ({ ...st, setNumber: si + 1 })) }
            : e,
        ),
      })),
      isDirty: true,
    });
  },

  updateSet: (weekNumber, sessionId, exerciseIndex, setIndex, updates) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => ({
        ...s,
        exercises: s.exercises.map((e, i) =>
          i === exerciseIndex
            ? { ...e, sets: e.sets.map((st, si) => (si === setIndex ? { ...st, ...updates } : st)) }
            : e,
        ),
      })),
      isDirty: true,
    });
  },

  updateExerciseNotes: (weekNumber, sessionId, exerciseIndex, notes) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => ({
        ...s,
        exercises: s.exercises.map((e, i) => (i === exerciseIndex ? { ...e, notes: notes || null } : e)),
      })),
      isDirty: true,
    });
  },

  updateExerciseRestSeconds: (weekNumber, sessionId, exerciseIndex, restSeconds) => {
    const { plan } = get();
    if (!plan) return;
    set({
      plan: updateSession(plan, weekNumber, sessionId, (s) => ({
        ...s,
        exercises: s.exercises.map((e, i) => (i === exerciseIndex ? { ...e, restSeconds } : e)),
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
              sessions: w.sessions.map((s) =>
                s.sessionId === fromSessionId
                  ? { ...s, exercises: s.exercises.filter((_, i) => i !== fromIndex).map((e, i) => ({ ...e, order: i + 1 })) }
                  : s,
              ),
            };
          }
          if (w.weekNumber === toWeek) {
            return {
              ...w,
              sessions: w.sessions.map((s) => {
                if (s.sessionId === toSessionId) {
                  const exercises = [...s.exercises];
                  exercises.splice(toIndex, 0, { ...exercise });
                  return { ...s, exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })) };
                }
                return s;
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
            exercises: s.exercises.map((e) => ({
              exerciseExternalId: e.exerciseExternalId,
              exerciseName: e.exerciseName,
              order: e.order,
              notes: e.notes,
              restSeconds: e.restSeconds,
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
      };

      const updated = await updateTrainingPlan(plan.planId, request);
      set({ plan: updated, originalPlan: structuredClone(updated), isDirty: false });
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
      set({ plan: updated, originalPlan: structuredClone(updated), isDirty: false });
      showSuccess('training.weekPublished');
    } catch (err) {
      showApiError(err, 'training.publishError');
    } finally {
      set({ isSaving: false });
    }
  },
}));

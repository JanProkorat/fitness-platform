import type {
  SessionExercise,
  TrainingSession,
  WodConfig,
  WorkoutFormat,
} from '@/api/training'

// ─── Ordered session items (workouts + standalone exercises interleaved) ────────

/**
 * One renderable block within a session: either a real multi-exercise
 * `TrainingWorkout`, or a synthetic single-exercise wrapper built from a
 * standalone session exercise so both shapes can share one rendering path.
 */
export interface SessionListItem {
  /** True for a synthetic wrapper around one standalone exercise; false for
   * a real `TrainingWorkout` with its own (possibly multi-exercise) block. */
  isStandalone: boolean
  /**
   * Stable key for list rendering and per-item completion lookups. The
   * workout's own `workoutId` for a real workout; the exercise's instance
   * `exerciseId` for a standalone wrapper. Workouts and standalone
   * exercises never share an id space, so this is safe to use as a single
   * combined React key / lookup key across both kinds of item.
   */
  itemId: string | undefined
  /** Shared session-level order — workouts and standalone exercises occupy
   * one ordering sequence (enforced server-side by
   * UpdateTrainingPlanValidator's cross-list duplicate-Order check). */
  order: number
  name: string | undefined
  format: WorkoutFormat | undefined
  formatConfig: WodConfig | undefined
  notes?: string | undefined
  exercises: SessionExercise[]
}

/**
 * Builds the single ordered list of session components — real workouts and
 * standalone exercises — interleaved by their shared `order` sequence.
 *
 * Scope is deliberately narrow: only `session.workouts` and
 * `session.standaloneExercises` participate in the merge. A nested
 * exercise's own `order` is scoped inside its workout, not the session, so
 * it must never be folded into this list — doing so double-renders it
 * whenever a nested exercise's order collides with a standalone exercise's
 * order (the QA fixture seeds exactly this collision: a nested exercise and
 * a standalone exercise both carry `order = 1`).
 *
 * No tie-break is needed: `UpdateTrainingPlanValidator` rejects duplicate
 * `order` values across `workouts` + `standaloneExercises`, so the two
 * lists this function merges are guaranteed to sort into a total order.
 *
 * Does NOT read `session.allExercises` — that field concatenates standalone
 * exercises first and is not `order`-sorted, so rendering it directly would
 * invert a session whose workout has `order = 0` and standalone exercise
 * has `order = 1`.
 */
export function getOrderedSessionItems(session: TrainingSession): SessionListItem[] {
  const workoutItems: SessionListItem[] = (session.workouts ?? []).map((workout) => ({
    isStandalone: false,
    itemId: workout.workoutId,
    order: workout.order ?? 0,
    name: workout.name,
    format: workout.format,
    formatConfig: workout.formatConfig,
    notes: workout.notes,
    exercises: workout.exercises ?? [],
  }))

  const standaloneItems: SessionListItem[] = (session.standaloneExercises ?? []).map(
    (exercise) => ({
      isStandalone: true,
      itemId: exercise.exerciseId,
      order: exercise.order ?? 0,
      name: exercise.exerciseName,
      format: exercise.format,
      formatConfig: exercise.formatConfig,
      notes: exercise.notes,
      exercises: [exercise],
    }),
  )

  return [...workoutItems, ...standaloneItems].sort((a, b) => a.order - b.order)
}

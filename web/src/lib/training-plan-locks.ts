import type { TrainingPlanDetail } from '@/api/training-plan-types';

/**
 * Derived "locked" sets that reflect which entities the client has already
 * marked as completed. Trainers must not edit these — past results would
 * be invalidated.
 *
 *   exerciseKeys — `${sessionId}:${workoutId}:${exerciseExternalId}` for each
 *                  completed exercise, scoped to the specific workout within
 *                  the session. Using the workout dimension prevents a false
 *                  lock when the same catalog exercise appears in multiple
 *                  workouts of the same session.
 *   sectionIds   — workouts that are "complete" — either every exercise in
 *                  them is locked, OR they have no exercises and the client
 *                  marked the workout itself complete (ForTime "Running"
 *                  style workouts).
 *   sessionIds   — sessions whose every workout is in `sectionIds` AND that
 *                  have at least one workout.
 *
 * The keys are stable for a given plan + completions snapshot, so memoizing
 * on `plan` in components is enough.
 */
export interface PlanLocks {
  exerciseKeys: Set<string>;
  sectionIds: Set<string>;
  sessionIds: Set<string>;
}

const EMPTY_LOCKS: PlanLocks = {
  exerciseKeys: new Set(),
  sectionIds: new Set(),
  sessionIds: new Set(),
};

/**
 * Build the composite key used to look up whether a specific exercise
 * instance (identified by its catalog `exerciseExternalId`) within a
 * specific workout of a specific session is locked.
 *
 * Scoping to `workoutId` is the fix for the duplicate-exercise bug: two
 * workouts can reference the same catalog exercise; only the one the client
 * actually completed should lock.
 */
export function exerciseLockKey(
  sessionId: string,
  workoutId: string,
  exerciseExternalId: string,
): string {
  return `${sessionId}:${workoutId}:${exerciseExternalId}`;
}

export function sectionLockKey(sessionId: string, workoutId: string): string {
  return `${sessionId}:${workoutId}`;
}

export function computePlanLocks(plan: TrainingPlanDetail | null): PlanLocks {
  if (!plan || !plan.completions || plan.completions.length === 0) return EMPTY_LOCKS;

  const exerciseKeys = new Set<string>();
  // `${sessionId}:${sectionId}` for any section the client section-completed.
  const sectionCompletionKeys = new Set<string>();

  for (const c of plan.completions) {
    if (c.completedExerciseIdsByWorkout) {
      // New shape: workout-scoped completion map. Each entry provides the
      // workoutId as the key and the list of completed exerciseExternalIds as
      // the value — this is the precise instance we need to lock.
      for (const [workoutId, exIds] of Object.entries(c.completedExerciseIdsByWorkout)) {
        for (const exId of exIds) {
          exerciseKeys.add(exerciseLockKey(c.sessionId, workoutId, exId));
        }
      }
    } else {
      // Transitional fallback for legacy backends that only emit the flat list.
      // We do not know which workout each exercise belongs to, so we must lock
      // across ALL workouts in this session — reproducing the old (buggy) flat
      // behaviour. This path only triggers against old backend versions.
      //
      // To build workout-scoped keys we need the workout data from the plan.
      // Find the sessions across all weeks and fan out the flat IDs into each
      // workout that contains the exercise.
      for (const week of plan.weeks) {
        for (const session of week.sessions) {
          if (session.sessionId !== c.sessionId) continue;
          for (const section of session.workouts) {
            for (const exId of c.completedExerciseIds) {
              // Only add a key if the exercise actually exists in this workout,
              // so we don't fabricate locks for workouts that don't contain it.
              if (section.exercises.some((ex) => ex.exerciseExternalId === exId)) {
                exerciseKeys.add(exerciseLockKey(c.sessionId, section.workoutId, exId));
              }
            }
          }
        }
      }
    }

    for (const workoutId of c.completedWorkoutIds ?? []) {
      sectionCompletionKeys.add(sectionLockKey(c.sessionId, workoutId));
    }
  }

  const sectionIds = new Set<string>();
  const sessionIds = new Set<string>();
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      if (session.workouts.length === 0) continue;
      let allSectionsLocked = true;
      for (const section of session.workouts) {
        let sectionLocked: boolean;
        if (section.exercises.length === 0) {
          // ForTime-style empty workout: lock when the workout itself was marked done.
          sectionLocked = sectionCompletionKeys.has(
            sectionLockKey(session.sessionId, section.workoutId),
          );
        } else {
          sectionLocked = section.exercises.every((ex) =>
            exerciseKeys.has(
              exerciseLockKey(session.sessionId, section.workoutId, ex.exerciseExternalId),
            ),
          );
        }
        if (sectionLocked) {
          sectionIds.add(section.workoutId);
        } else {
          allSectionsLocked = false;
        }
      }
      if (allSectionsLocked) {
        sessionIds.add(session.sessionId);
      }
    }
  }

  return { exerciseKeys, sectionIds, sessionIds };
}

import type { TrainingPlanDetail } from '@/api/training-plan-types';

/**
 * Derived "locked" sets that reflect which entities the client has already
 * marked as completed. Trainers must not edit these — past results would
 * be invalidated.
 *
 *   exerciseKeys — `${sessionId}:${sectionId}:${exerciseExternalId}` for each
 *                  completed exercise, scoped to the specific section within
 *                  the session. Using the section dimension prevents a false
 *                  lock when the same catalog exercise appears in multiple
 *                  sections of the same session.
 *   sectionIds   — sections that are "complete" — either every exercise in
 *                  them is locked, OR they have no exercises and the client
 *                  marked the section itself complete (ForTime "Running"
 *                  style workouts).
 *   sessionIds   — sessions whose every section is in `sectionIds` AND that
 *                  have at least one section.
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
 * specific section of a specific session is locked.
 *
 * Scoping to `sectionId` is the fix for the duplicate-exercise bug: two
 * sections can reference the same catalog exercise; only the one the client
 * actually completed should lock.
 */
export function exerciseLockKey(
  sessionId: string,
  sectionId: string,
  exerciseExternalId: string,
): string {
  return `${sessionId}:${sectionId}:${exerciseExternalId}`;
}

export function sectionLockKey(sessionId: string, sectionId: string): string {
  return `${sessionId}:${sectionId}`;
}

export function computePlanLocks(plan: TrainingPlanDetail | null): PlanLocks {
  if (!plan || !plan.completions || plan.completions.length === 0) return EMPTY_LOCKS;

  const exerciseKeys = new Set<string>();
  // `${sessionId}:${sectionId}` for any section the client section-completed.
  const sectionCompletionKeys = new Set<string>();

  for (const c of plan.completions) {
    if (c.completedExerciseIdsBySection) {
      // New shape: section-scoped completion map. Each entry provides the
      // sectionId as the key and the list of completed exerciseExternalIds as
      // the value — this is the precise instance we need to lock.
      for (const [sectionId, exIds] of Object.entries(c.completedExerciseIdsBySection)) {
        for (const exId of exIds) {
          exerciseKeys.add(exerciseLockKey(c.sessionId, sectionId, exId));
        }
      }
    } else {
      // Transitional fallback for legacy backends that only emit the flat list.
      // We do not know which section each exercise belongs to, so we must lock
      // across ALL sections in this session — reproducing the old (buggy) flat
      // behaviour. This path only triggers against old backend versions.
      //
      // To build section-scoped keys we need the section data from the plan.
      // Find the sessions across all weeks and fan out the flat IDs into each
      // section that contains the exercise.
      for (const week of plan.weeks) {
        for (const session of week.sessions) {
          if (session.sessionId !== c.sessionId) continue;
          for (const section of session.sections) {
            for (const exId of c.completedExerciseIds) {
              // Only add a key if the exercise actually exists in this section,
              // so we don't fabricate locks for sections that don't contain it.
              if (section.exercises.some((ex) => ex.exerciseExternalId === exId)) {
                exerciseKeys.add(exerciseLockKey(c.sessionId, section.sectionId, exId));
              }
            }
          }
        }
      }
    }

    for (const secId of c.completedSectionIds ?? []) {
      sectionCompletionKeys.add(sectionLockKey(c.sessionId, secId));
    }
  }

  const sectionIds = new Set<string>();
  const sessionIds = new Set<string>();
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      if (session.sections.length === 0) continue;
      let allSectionsLocked = true;
      for (const section of session.sections) {
        let sectionLocked: boolean;
        if (section.exercises.length === 0) {
          // ForTime-style empty section: lock when section itself was marked done.
          sectionLocked = sectionCompletionKeys.has(
            sectionLockKey(session.sessionId, section.sectionId),
          );
        } else {
          sectionLocked = section.exercises.every((ex) =>
            exerciseKeys.has(
              exerciseLockKey(session.sessionId, section.sectionId, ex.exerciseExternalId),
            ),
          );
        }
        if (sectionLocked) {
          sectionIds.add(section.sectionId);
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

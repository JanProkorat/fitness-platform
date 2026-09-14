/**
 * Unit tests for trainingCardHelpers — pure functions, no RN dependencies.
 */

import { deriveSessionCtaState, computeLockedSessionIds } from '../trainingCardHelpers'
import type { TrainingSession } from '@/api/training'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a session with a single workout holding the given instance-keyed
 * exercises. Mirrors the dominant real-world shape of a single-workout session.
 */
function makeSession(
  exerciseIds: Array<string | undefined>,
  workoutId = 'w-1',
): TrainingSession {
  return {
    sessionId: 'sess-1',
    name: 'Push Day',
    workouts: [
      {
        workoutId,
        name: 'Hlavní',
        exercises: exerciseIds.map((id, i) => ({
          exerciseId: id,
          exerciseExternalId: `ext-${i + 1}`,
          exerciseName: `Exercise ${i + 1}`,
          sets: [{ setNumber: 1, reps: 10 }],
        })),
      },
    ],
    standaloneExercises: [],
  }
}

const EMPTY_SET = new Set<string>()

// ─── deriveSessionCtaState ────────────────────────────────────────────────────

describe('deriveSessionCtaState', () => {
  describe('not-started', () => {
    it('returns not-started when no exercises are completed', () => {
      const session = makeSession(['inst-1', 'inst-2', 'inst-3'])
      const result = deriveSessionCtaState(session, EMPTY_SET, EMPTY_SET)
      expect(result).toBe('not-started')
    })

    it('returns not-started when completedIds has ids from a different instance', () => {
      const session = makeSession(['inst-1', 'inst-2'])
      const result = deriveSessionCtaState(session, new Set(['inst-other-1', 'inst-other-2']), EMPTY_SET)
      expect(result).toBe('not-started')
    })
  })

  describe('in-progress', () => {
    it('returns in-progress when some but not all exercises are completed', () => {
      const session = makeSession(['inst-1', 'inst-2', 'inst-3'])
      const result = deriveSessionCtaState(session, new Set(['inst-1']), EMPTY_SET)
      expect(result).toBe('in-progress')
    })

    it('returns in-progress when all but one exercise is completed', () => {
      const session = makeSession(['inst-1', 'inst-2', 'inst-3'])
      const result = deriveSessionCtaState(session, new Set(['inst-1', 'inst-2']), EMPTY_SET)
      expect(result).toBe('in-progress')
    })
  })

  describe('finished', () => {
    it('returns finished when all exercises are completed', () => {
      const session = makeSession(['inst-1', 'inst-2', 'inst-3'])
      const result = deriveSessionCtaState(session, new Set(['inst-1', 'inst-2', 'inst-3']), EMPTY_SET)
      expect(result).toBe('finished')
    })

    it('returns finished for a session with no workouts and no standalone exercises', () => {
      const session: TrainingSession = { sessionId: 'sess-empty', name: 'Empty', workouts: [], standaloneExercises: [] }
      const result = deriveSessionCtaState(session, EMPTY_SET, EMPTY_SET)
      expect(result).toBe('finished')
    })

    it('returns finished when workouts and standaloneExercises are undefined', () => {
      const session: TrainingSession = { sessionId: 'sess-undef', name: 'Undefined' }
      const result = deriveSessionCtaState(session, EMPTY_SET, EMPTY_SET)
      expect(result).toBe('finished')
    })

    it('returns finished when completedIds is a superset of trackable ids', () => {
      const session = makeSession(['inst-1', 'inst-2'])
      const result = deriveSessionCtaState(session, new Set(['inst-1', 'inst-2', 'inst-extra']), EMPTY_SET)
      expect(result).toBe('finished')
    })
  })

  describe('exercises without exerciseId', () => {
    it('ignores exercises with undefined id and counts only trackable ones', () => {
      const session = makeSession(['inst-1', undefined, 'inst-3'])
      const result = deriveSessionCtaState(session, new Set(['inst-1', 'inst-3']), EMPTY_SET)
      expect(result).toBe('finished')
    })

    it('returns not-started when all exercises have undefined ids and no workout is marked complete', () => {
      const session = makeSession([undefined, undefined])
      const result = deriveSessionCtaState(session, EMPTY_SET, EMPTY_SET)
      expect(result).toBe('not-started')
    })

    it('returns finished when all exercises have undefined ids and the workout is marked complete', () => {
      const session = makeSession([undefined, undefined], 'w-1')
      const result = deriveSessionCtaState(session, EMPTY_SET, new Set(['w-1']))
      expect(result).toBe('finished')
    })

    it('returns not-started when un-trackable exercises are mixed with un-completed trackable ones', () => {
      const session = makeSession([undefined, 'inst-2'])
      const result = deriveSessionCtaState(session, EMPTY_SET, EMPTY_SET)
      expect(result).toBe('not-started')
    })

    it('returns in-progress when some trackable exercises are complete alongside un-trackable', () => {
      const session = makeSession([undefined, 'inst-2', 'inst-3'])
      const result = deriveSessionCtaState(session, new Set(['inst-2']), EMPTY_SET)
      expect(result).toBe('in-progress')
    })
  })

  describe('cross-placement isolation (the regression this migration must preserve)', () => {
    /**
     * W1 and W3 both contain catalog exercise "push-up" (same exerciseExternalId)
     * but as two DIFFERENT instances (different exerciseId). Marking the W1
     * instance done must NOT satisfy the W3 instance's completion check —
     * this is now guaranteed structurally by instance ids being distinct,
     * rather than by a per-workout Map keyed on the catalog id.
     */
    it('does not count the W3 instance as done because the W1 instance was marked', () => {
      const session: TrainingSession = {
        sessionId: 'sess-1',
        name: 'Multi-Workout',
        workouts: [
          {
            workoutId: 'w1',
            name: 'W1',
            exercises: [
              { exerciseId: 'w1-push-up', exerciseExternalId: 'push-up', exerciseName: 'Push Up', sets: [] },
              { exerciseId: 'w1-squat', exerciseExternalId: 'squat', exerciseName: 'Squat', sets: [] },
            ],
          },
          {
            workoutId: 'w2',
            name: 'W2',
            exercises: [
              { exerciseId: 'w2-row', exerciseExternalId: 'row', exerciseName: 'Row', sets: [] },
              { exerciseId: 'w2-deadlift', exerciseExternalId: 'deadlift', exerciseName: 'Deadlift', sets: [] },
            ],
          },
          {
            workoutId: 'w3',
            name: 'W3',
            exercises: [
              { exerciseId: 'w3-push-up', exerciseExternalId: 'push-up', exerciseName: 'Push Up', sets: [] },
              { exerciseId: 'w3-burpee', exerciseExternalId: 'burpee', exerciseName: 'Burpee', sets: [] },
              // w3-lunge is NOT marked complete
              { exerciseId: 'w3-lunge', exerciseExternalId: 'lunge', exerciseName: 'Lunge', sets: [] },
            ],
          },
        ],
        standaloneExercises: [],
      }

      // W1 fully done, W2 fully done, W3: 2 of 3 instances done (w3-lunge missing)
      const completed = new Set([
        'w1-push-up', 'w1-squat',
        'w2-row', 'w2-deadlift',
        'w3-push-up', 'w3-burpee',
      ])

      const result = deriveSessionCtaState(session, completed, EMPTY_SET)
      expect(result).toBe('in-progress')
    })
  })

  describe('workouts without trackable exercises (ForTime/Running)', () => {
    it('counts a no-exercise workout as done when workoutId is in completedWorkoutIds', () => {
      const session: TrainingSession = {
        sessionId: 'sess-1',
        name: 'ForTime Day',
        workouts: [{ workoutId: 'run-workout', name: 'Running', exercises: [] }],
        standaloneExercises: [],
      }

      const result = deriveSessionCtaState(session, EMPTY_SET, new Set(['run-workout']))
      expect(result).toBe('finished')
    })

    it('returns not-started for a no-exercise workout when workoutId is not in completedWorkoutIds', () => {
      const session: TrainingSession = {
        sessionId: 'sess-1',
        name: 'ForTime Day',
        workouts: [{ workoutId: 'run-workout', name: 'Running', exercises: [] }],
        standaloneExercises: [],
      }

      const result = deriveSessionCtaState(session, EMPTY_SET, EMPTY_SET)
      expect(result).toBe('not-started')
    })

    it('returns in-progress when one workout is complete and another has partial exercises done', () => {
      const session: TrainingSession = {
        sessionId: 'sess-1',
        name: 'Mixed',
        workouts: [
          { workoutId: 'run-workout', name: 'Running', exercises: [] },
          {
            workoutId: 'lift-workout',
            name: 'Lifting',
            exercises: [
              { exerciseId: 'lift-deadlift', exerciseExternalId: 'deadlift', exerciseName: 'Deadlift', sets: [] },
              { exerciseId: 'lift-squat', exerciseExternalId: 'squat', exerciseName: 'Squat', sets: [] },
            ],
          },
        ],
        standaloneExercises: [],
      }

      // Running workout done, only 1 of 2 lifting exercise instances done
      const result = deriveSessionCtaState(session, new Set(['lift-deadlift']), new Set(['run-workout']))
      expect(result).toBe('in-progress')
    })
  })

  describe('standalone exercises', () => {
    it('counts standalone exercises alongside nested workout exercises', () => {
      const session: TrainingSession = {
        sessionId: 'sess-1',
        name: 'Push Day + finisher',
        workouts: [
          {
            workoutId: 'w1',
            name: 'Hlavní',
            exercises: [{ exerciseId: 'w1-bench', exerciseExternalId: 'bench', exerciseName: 'Bench', sets: [] }],
          },
        ],
        standaloneExercises: [
          { exerciseId: 'standalone-plank', exerciseExternalId: 'plank', exerciseName: 'Plank', sets: [] },
        ],
      }

      const inProgress = deriveSessionCtaState(session, new Set(['w1-bench']), EMPTY_SET)
      expect(inProgress).toBe('in-progress')

      const finished = deriveSessionCtaState(
        session,
        new Set(['w1-bench', 'standalone-plank']),
        EMPTY_SET,
      )
      expect(finished).toBe('finished')
    })

    it('completing a standalone instance does not complete a nested instance of the same catalog exercise', () => {
      // Dual-placement fixture: same catalog exercise nested AND standalone in one session.
      const session: TrainingSession = {
        sessionId: 'sess-1',
        name: 'Dual placement',
        workouts: [
          {
            workoutId: 'w1',
            name: 'Hlavní',
            exercises: [
              { exerciseId: 'nested-wall-ball', exerciseExternalId: 'wall-ball', exerciseName: 'Wall Ball', sets: [] },
            ],
          },
        ],
        standaloneExercises: [
          { exerciseId: 'standalone-wall-ball', exerciseExternalId: 'wall-ball', exerciseName: 'Wall Ball', sets: [] },
        ],
      }

      const result = deriveSessionCtaState(session, new Set(['standalone-wall-ball']), EMPTY_SET)
      expect(result).toBe('in-progress')
    })
  })
})

// ─── computeLockedSessionIds ──────────────────────────────────────────────────

describe('computeLockedSessionIds', () => {
  function makeSessionWithId(id: string): TrainingSession {
    return {
      sessionId: id,
      name: `Session ${id}`,
      workouts: [],
      standaloneExercises: [],
    }
  }

  const sessions = [
    makeSessionWithId('s1'),
    makeSessionWithId('s2'),
    makeSessionWithId('s3'),
  ]

  it('returns empty set when hasActiveSession is false', () => {
    const result = computeLockedSessionIds(sessions, false, 's1')
    expect(result.size).toBe(0)
  })

  it('returns empty set when activeSessionId is null', () => {
    const result = computeLockedSessionIds(sessions, true, null)
    expect(result.size).toBe(0)
  })

  it('returns empty set when hasActiveSession is false and activeSessionId is null', () => {
    const result = computeLockedSessionIds(sessions, false, null)
    expect(result.size).toBe(0)
  })

  it('returns the other session IDs excluding the active one', () => {
    const result = computeLockedSessionIds(sessions, true, 's1')
    expect(result.size).toBe(2)
    expect(result.has('s2')).toBe(true)
    expect(result.has('s3')).toBe(true)
    expect(result.has('s1')).toBe(false)
  })

  it('returns correct locked set when the middle session is active', () => {
    const result = computeLockedSessionIds(sessions, true, 's2')
    expect(result.has('s1')).toBe(true)
    expect(result.has('s3')).toBe(true)
    expect(result.has('s2')).toBe(false)
  })

  it('filters out sessions with null sessionId cleanly', () => {
    const sessionsWithNull: TrainingSession[] = [
      makeSessionWithId('s1'),
      { sessionId: undefined, name: 'No-id session', workouts: [], standaloneExercises: [] },
      makeSessionWithId('s3'),
    ]
    const result = computeLockedSessionIds(sessionsWithNull, true, 's1')
    expect(result.has('s3')).toBe(true)
    // The undefined-id session must not appear in the locked set
    expect(result.size).toBe(1)
  })

  it('returns empty set when sessions array is empty', () => {
    const result = computeLockedSessionIds([], true, 's1')
    expect(result.size).toBe(0)
  })
})

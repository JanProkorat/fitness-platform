/**
 * Unit tests for trainingCardHelpers — pure functions, no RN dependencies.
 */

import { deriveSessionCtaState, computeLockedSessionIds } from '../trainingCardHelpers'
import type { TrainingSession } from '@/api/training'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a session whose exercises live inside a single section.
 * This mirrors the dominant real-world shape after WithBackfilledSections
 * runs on the server.
 */
function makeSession(
  exerciseExternalIds: Array<string | undefined>,
  sectionId = 'sec-1',
): TrainingSession {
  return {
    sessionId: 'sess-1',
    name: 'Push Day',
    sections: [
      {
        sectionId,
        name: 'Hlavní',
        exercises: exerciseExternalIds.map((id, i) => ({
          exerciseExternalId: id,
          exerciseName: `Exercise ${i + 1}`,
          sets: [{ setNumber: 1, reps: 10 }],
        })),
      },
    ],
    // exercises is the flat convenience view — kept in sync for legacy callers
    exercises: exerciseExternalIds.map((id, i) => ({
      exerciseExternalId: id,
      exerciseName: `Exercise ${i + 1}`,
      sets: [{ setNumber: 1, reps: 10 }],
    })),
  }
}

/** Build a per-section completed-ids map for a single section. */
function sectionMap(
  sectionId: string,
  ids: ReadonlySet<string>,
): ReadonlyMap<string, ReadonlySet<string>> {
  return new Map([[sectionId, ids]])
}

const EMPTY_MAP = new Map<string, ReadonlySet<string>>()
const EMPTY_SET = new Set<string>()

// ─── deriveSessionCtaState ────────────────────────────────────────────────────

describe('deriveSessionCtaState', () => {
  describe('not-started', () => {
    it('returns not-started when no exercises are completed', () => {
      const session = makeSession(['ex-1', 'ex-2', 'ex-3'])
      const result = deriveSessionCtaState(session, EMPTY_MAP, EMPTY_SET)
      expect(result).toBe('not-started')
    })

    it('returns not-started when completedIds has ids from a different section', () => {
      const session = makeSession(['ex-1', 'ex-2'])
      // Ids belong to 'other-section', not 'sec-1' — should not satisfy sec-1
      const result = deriveSessionCtaState(
        session,
        sectionMap('other-section', new Set(['ex-1', 'ex-2'])),
        EMPTY_SET,
      )
      expect(result).toBe('not-started')
    })
  })

  describe('in-progress', () => {
    it('returns in-progress when some but not all exercises are completed', () => {
      const session = makeSession(['ex-1', 'ex-2', 'ex-3'])
      const result = deriveSessionCtaState(
        session,
        sectionMap('sec-1', new Set(['ex-1'])),
        EMPTY_SET,
      )
      expect(result).toBe('in-progress')
    })

    it('returns in-progress when all but one exercise is completed', () => {
      const session = makeSession(['ex-1', 'ex-2', 'ex-3'])
      const result = deriveSessionCtaState(
        session,
        sectionMap('sec-1', new Set(['ex-1', 'ex-2'])),
        EMPTY_SET,
      )
      expect(result).toBe('in-progress')
    })
  })

  describe('finished', () => {
    it('returns finished when all exercises are completed', () => {
      const session = makeSession(['ex-1', 'ex-2', 'ex-3'])
      const result = deriveSessionCtaState(
        session,
        sectionMap('sec-1', new Set(['ex-1', 'ex-2', 'ex-3'])),
        EMPTY_SET,
      )
      expect(result).toBe('finished')
    })

    it('returns finished for a session with no sections and no exercises', () => {
      const session: TrainingSession = { sessionId: 'sess-empty', name: 'Empty', sections: [], exercises: [] }
      const result = deriveSessionCtaState(session, EMPTY_MAP, EMPTY_SET)
      expect(result).toBe('finished')
    })

    it('returns finished when sections and exercises arrays are undefined', () => {
      const session: TrainingSession = { sessionId: 'sess-undef', name: 'Undefined' }
      const result = deriveSessionCtaState(session, EMPTY_MAP, EMPTY_SET)
      expect(result).toBe('finished')
    })

    it('returns finished when completedIds is a superset of trackable ids', () => {
      const session = makeSession(['ex-1', 'ex-2'])
      // Extra ids beyond this session — still finished
      const result = deriveSessionCtaState(
        session,
        sectionMap('sec-1', new Set(['ex-1', 'ex-2', 'ex-extra'])),
        EMPTY_SET,
      )
      expect(result).toBe('finished')
    })
  })

  describe('exercises without exerciseExternalId', () => {
    it('ignores exercises with undefined id and counts only trackable ones', () => {
      // 2 trackable, 1 un-trackable — completing the 2 trackable means finished
      const session = makeSession(['ex-1', undefined, 'ex-3'])
      const result = deriveSessionCtaState(
        session,
        sectionMap('sec-1', new Set(['ex-1', 'ex-3'])),
        EMPTY_SET,
      )
      expect(result).toBe('finished')
    })

    it('returns not-started when all exercises have undefined ids and no section is marked complete', () => {
      const session = makeSession([undefined, undefined])
      const result = deriveSessionCtaState(session, EMPTY_MAP, EMPTY_SET)
      // All un-trackable, section not in completedSectionIds → not-started
      expect(result).toBe('not-started')
    })

    it('returns finished when all exercises have undefined ids and the section is marked complete', () => {
      const session = makeSession([undefined, undefined])
      const result = deriveSessionCtaState(session, EMPTY_MAP, new Set(['sec-1']))
      expect(result).toBe('finished')
    })

    it('returns not-started when un-trackable exercises are mixed with un-completed trackable ones', () => {
      const session = makeSession([undefined, 'ex-2'])
      const result = deriveSessionCtaState(session, EMPTY_MAP, EMPTY_SET)
      expect(result).toBe('not-started')
    })

    it('returns in-progress when some trackable exercises are complete alongside un-trackable', () => {
      const session = makeSession([undefined, 'ex-2', 'ex-3'])
      const result = deriveSessionCtaState(
        session,
        sectionMap('sec-1', new Set(['ex-2'])),
        EMPTY_SET,
      )
      expect(result).toBe('in-progress')
    })
  })

  describe('cross-section isolation (the regression)', () => {
    /**
     * Regression test for the bug described in the fix spec:
     * W1 and W3 both contain catalog exercise "push-up" (same exerciseExternalId).
     * Marking it done in W1 must NOT satisfy W3's completion check.
     */
    it('does not count an exercise in W3 as done because it was marked in W1', () => {
      const session: TrainingSession = {
        sessionId: 'sess-1',
        name: 'Multi-Workout',
        sections: [
          {
            sectionId: 'w1',
            name: 'W1',
            exercises: [
              { exerciseExternalId: 'push-up', exerciseName: 'Push Up', sets: [] },
              { exerciseExternalId: 'squat', exerciseName: 'Squat', sets: [] },
            ],
          },
          {
            sectionId: 'w2',
            name: 'W2',
            exercises: [
              { exerciseExternalId: 'row', exerciseName: 'Row', sets: [] },
              { exerciseExternalId: 'deadlift', exerciseName: 'Deadlift', sets: [] },
            ],
          },
          {
            sectionId: 'w3',
            name: 'W3',
            exercises: [
              { exerciseExternalId: 'push-up', exerciseName: 'Push Up', sets: [] },
              { exerciseExternalId: 'burpee', exerciseName: 'Burpee', sets: [] },
              // ex-3 is NOT marked complete
              { exerciseExternalId: 'lunge', exerciseName: 'Lunge', sets: [] },
            ],
          },
        ],
      }

      // W1 fully done, W2 fully done, W3: 2 of 3 done (lunge missing)
      const map: ReadonlyMap<string, ReadonlySet<string>> = new Map([
        ['w1', new Set(['push-up', 'squat'])],
        ['w2', new Set(['row', 'deadlift'])],
        ['w3', new Set(['push-up', 'burpee'])], // lunge NOT in set
      ])

      const result = deriveSessionCtaState(session, map, EMPTY_SET)
      // Should be in-progress, not finished — W3.lunge is still pending
      expect(result).toBe('in-progress')
    })

    it('returns finished only when every section is fully done', () => {
      const session: TrainingSession = {
        sessionId: 'sess-1',
        name: 'Multi-Workout',
        sections: [
          {
            sectionId: 'w1',
            name: 'W1',
            exercises: [{ exerciseExternalId: 'push-up', exerciseName: 'Push Up', sets: [] }],
          },
          {
            sectionId: 'w3',
            name: 'W3',
            exercises: [
              { exerciseExternalId: 'push-up', exerciseName: 'Push Up', sets: [] },
              { exerciseExternalId: 'lunge', exerciseName: 'Lunge', sets: [] },
            ],
          },
        ],
      }

      const map: ReadonlyMap<string, ReadonlySet<string>> = new Map([
        ['w1', new Set(['push-up'])],
        ['w3', new Set(['push-up', 'lunge'])],
      ])

      const result = deriveSessionCtaState(session, map, EMPTY_SET)
      expect(result).toBe('finished')
    })
  })

  describe('sections without trackable exercises (ForTime/Running)', () => {
    it('counts a no-exercise section as done when sectionId is in completedSectionIds', () => {
      const session: TrainingSession = {
        sessionId: 'sess-1',
        name: 'ForTime Day',
        sections: [
          { sectionId: 'run-sec', name: 'Running', exercises: [] },
        ],
      }

      const result = deriveSessionCtaState(session, EMPTY_MAP, new Set(['run-sec']))
      expect(result).toBe('finished')
    })

    it('returns not-started for a no-exercise section when sectionId is not in completedSectionIds', () => {
      const session: TrainingSession = {
        sessionId: 'sess-1',
        name: 'ForTime Day',
        sections: [
          { sectionId: 'run-sec', name: 'Running', exercises: [] },
        ],
      }

      const result = deriveSessionCtaState(session, EMPTY_MAP, EMPTY_SET)
      expect(result).toBe('not-started')
    })

    it('returns in-progress when one section is complete and another has partial exercises done', () => {
      const session: TrainingSession = {
        sessionId: 'sess-1',
        name: 'Mixed',
        sections: [
          { sectionId: 'run-sec', name: 'Running', exercises: [] },
          {
            sectionId: 'lift-sec',
            name: 'Lifting',
            exercises: [
              { exerciseExternalId: 'deadlift', exerciseName: 'Deadlift', sets: [] },
              { exerciseExternalId: 'squat', exerciseName: 'Squat', sets: [] },
            ],
          },
        ],
      }

      // Running section done, only 1 of 2 lifting exercises done
      const result = deriveSessionCtaState(
        session,
        sectionMap('lift-sec', new Set(['deadlift'])),
        new Set(['run-sec']),
      )
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
      sections: [],
      exercises: [],
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
      { sessionId: undefined, name: 'No-id session', sections: [], exercises: [] },
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

/**
 * Unit tests for trainingCardHelpers — pure functions, no RN dependencies.
 */

import { deriveSessionCtaState } from '../trainingCardHelpers'
import type { TrainingSession } from '@/api/training'

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeSession(exerciseExternalIds: Array<string | undefined>): TrainingSession {
  return {
    sessionId: 'sess-1',
    name: 'Push Day',
    exercises: exerciseExternalIds.map((id, i) => ({
      exerciseExternalId: id,
      exerciseName: `Exercise ${i + 1}`,
      sets: [{ setNumber: 1, reps: 10 }],
    })),
  }
}

// ─── deriveSessionCtaState ────────────────────────────────────────────────────

describe('deriveSessionCtaState', () => {
  describe('not-started', () => {
    it('returns not-started when no exercises are completed', () => {
      const session = makeSession(['ex-1', 'ex-2', 'ex-3'])
      const result = deriveSessionCtaState(session, new Set())
      expect(result).toBe('not-started')
    })

    it('returns not-started when completedExerciseIds has ids from other sessions', () => {
      const session = makeSession(['ex-1', 'ex-2'])
      // Different exercise ids — don't belong to this session
      const result = deriveSessionCtaState(session, new Set(['ex-other-1', 'ex-other-2']))
      expect(result).toBe('not-started')
    })
  })

  describe('in-progress', () => {
    it('returns in-progress when some but not all exercises are completed', () => {
      const session = makeSession(['ex-1', 'ex-2', 'ex-3'])
      const result = deriveSessionCtaState(session, new Set(['ex-1']))
      expect(result).toBe('in-progress')
    })

    it('returns in-progress when all but one exercise is completed', () => {
      const session = makeSession(['ex-1', 'ex-2', 'ex-3'])
      const result = deriveSessionCtaState(session, new Set(['ex-1', 'ex-2']))
      expect(result).toBe('in-progress')
    })
  })

  describe('finished', () => {
    it('returns finished when all exercises are completed', () => {
      const session = makeSession(['ex-1', 'ex-2', 'ex-3'])
      const result = deriveSessionCtaState(session, new Set(['ex-1', 'ex-2', 'ex-3']))
      expect(result).toBe('finished')
    })

    it('returns finished for a session with no exercises', () => {
      const session: TrainingSession = { sessionId: 'sess-empty', name: 'Empty', exercises: [] }
      const result = deriveSessionCtaState(session, new Set())
      expect(result).toBe('finished')
    })

    it('returns finished when exercises array is undefined', () => {
      const session: TrainingSession = { sessionId: 'sess-undef', name: 'Undefined' }
      const result = deriveSessionCtaState(session, new Set())
      expect(result).toBe('finished')
    })

    it('returns finished when completedIds is a superset of trackable ids', () => {
      const session = makeSession(['ex-1', 'ex-2'])
      // Extra ids beyond this session — still finished
      const result = deriveSessionCtaState(session, new Set(['ex-1', 'ex-2', 'ex-extra']))
      expect(result).toBe('finished')
    })
  })

  describe('exercises without exerciseExternalId', () => {
    it('ignores exercises with undefined id and counts only trackable ones', () => {
      // 2 trackable, 1 un-trackable — completing the 2 trackable means finished
      const session = makeSession(['ex-1', undefined, 'ex-3'])
      const result = deriveSessionCtaState(session, new Set(['ex-1', 'ex-3']))
      expect(result).toBe('finished')
    })

    it('returns finished when all exercises have undefined ids', () => {
      const session = makeSession([undefined, undefined])
      const result = deriveSessionCtaState(session, new Set())
      // All un-trackable → treated as finished (no CTA needed)
      expect(result).toBe('finished')
    })

    it('returns not-started when un-trackable exercises are mixed with un-completed trackable ones', () => {
      const session = makeSession([undefined, 'ex-2'])
      const result = deriveSessionCtaState(session, new Set())
      expect(result).toBe('not-started')
    })

    it('returns in-progress when some trackable exercises are complete alongside un-trackable', () => {
      const session = makeSession([undefined, 'ex-2', 'ex-3'])
      const result = deriveSessionCtaState(session, new Set(['ex-2']))
      expect(result).toBe('in-progress')
    })
  })
})

/**
 * Tests for multi-session TrainingCard logic.
 * Pure-function tests — no React Native dependencies.
 */

import { deriveSessionCtaState } from '../trainingCardHelpers'
import type { TrainingSession } from '@/api/training'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSession(id: string, exerciseIds: string[]): TrainingSession {
  return {
    sessionId: id,
    name: `Session ${id}`,
    exercises: exerciseIds.map((exId, i) => ({
      exerciseExternalId: exId,
      exerciseName: `Exercise ${i + 1}`,
      sets: [{ setNumber: 1, reps: 10 }],
    })),
  }
}

// ─── Multi-session aggregation ────────────────────────────────────────────────

describe('multi-session completion aggregation', () => {
  const sessions = [
    makeSession('s1', ['ex-1', 'ex-2']),
    makeSession('s2', ['ex-3', 'ex-4', 'ex-5']),
  ]

  it('aggregates total exercise count across sessions', () => {
    const total = sessions.reduce(
      (sum, s) => sum + (s.exercises ?? []).filter((e) => e.exerciseExternalId != null).length,
      0,
    )
    expect(total).toBe(5)
  })

  it('aggregates completed count across sessions', () => {
    const completedBySession: Record<string, ReadonlySet<string>> = {
      s1: new Set(['ex-1']),
      s2: new Set(['ex-3', 'ex-5']),
    }
    const done = sessions.reduce((sum, s) => {
      const ids = completedBySession[s.sessionId ?? ''] ?? new Set<string>()
      return sum + ids.size
    }, 0)
    expect(done).toBe(3)
  })

  it('deriveSessionCtaState handles each session independently', () => {
    const completedBySession: Record<string, ReadonlySet<string>> = {
      s1: new Set<string>(),
      s2: new Set(['ex-3', 'ex-4', 'ex-5']),
    }

    const s1State = deriveSessionCtaState(sessions[0]!, completedBySession['s1']!)
    const s2State = deriveSessionCtaState(sessions[1]!, completedBySession['s2']!)

    expect(s1State).toBe('not-started')
    expect(s2State).toBe('finished')
  })

  it('returns not-started when completedIdsBySession is empty', () => {
    for (const session of sessions) {
      const state = deriveSessionCtaState(session, new Set<string>())
      expect(state).toBe('not-started')
    }
  })

  it('handles an empty sessions array gracefully', () => {
    const emptySessions: TrainingSession[] = []
    const total = emptySessions.reduce(
      (sum, s) => sum + (s.exercises ?? []).filter((e) => e.exerciseExternalId != null).length,
      0,
    )
    expect(total).toBe(0)
  })
})

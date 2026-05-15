/**
 * Tests for multi-session TrainingCard logic.
 * Pure-function tests — no React Native dependencies.
 */

import { deriveSessionCtaState } from '../trainingCardHelpers'
import type { TrainingSession } from '@/api/training'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Build a session with a single section containing the given exercises.
 * Mirrors WithBackfilledSections output (one default section per session).
 */
function makeSession(id: string, exerciseIds: string[]): TrainingSession {
  return {
    sessionId: id,
    name: `Session ${id}`,
    sections: [
      {
        sectionId: `${id}-sec`,
        name: 'Hlavní',
        exercises: exerciseIds.map((exId, i) => ({
          exerciseExternalId: exId,
          exerciseName: `Exercise ${i + 1}`,
          sets: [{ setNumber: 1, reps: 10 }],
        })),
      },
    ],
    exercises: exerciseIds.map((exId, i) => ({
      exerciseExternalId: exId,
      exerciseName: `Exercise ${i + 1}`,
      sets: [{ setNumber: 1, reps: 10 }],
    })),
  }
}

/** Wrap a section-level completed-ids set into the per-section map shape. */
function makeSectionMap(
  sectionId: string,
  ids: ReadonlySet<string>,
): ReadonlyMap<string, ReadonlySet<string>> {
  return new Map([[sectionId, ids]])
}

const EMPTY_MAP = new Map<string, ReadonlySet<string>>()
const EMPTY_SET = new Set<string>()

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
    const s1Map = makeSectionMap('s1-sec', new Set<string>())
    const s2Map = makeSectionMap('s2-sec', new Set(['ex-3', 'ex-4', 'ex-5']))

    const s1State = deriveSessionCtaState(sessions[0]!, s1Map, EMPTY_SET)
    const s2State = deriveSessionCtaState(sessions[1]!, s2Map, EMPTY_SET)

    expect(s1State).toBe('not-started')
    expect(s2State).toBe('finished')
  })

  it('returns not-started when completedIdsBySectionAndSession is empty', () => {
    for (const session of sessions) {
      const state = deriveSessionCtaState(session, EMPTY_MAP, EMPTY_SET)
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

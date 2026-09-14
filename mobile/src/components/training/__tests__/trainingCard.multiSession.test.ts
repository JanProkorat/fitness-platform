/**
 * Tests for multi-session TrainingCard logic.
 * Pure-function tests — no React Native dependencies.
 */

import { deriveSessionCtaState } from '../trainingCardHelpers'
import type { SessionExercise, TrainingSession } from '@/api/training'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Build a session with a single workout containing the given exercise
 * instances. Every document is created directly in the workouts shape —
 * there is no legacy flat-exercises fallback to mirror any more.
 */
function makeSession(id: string, exerciseIds: string[]): TrainingSession {
  return {
    sessionId: id,
    name: `Session ${id}`,
    workouts: [
      {
        workoutId: `${id}-w1`,
        name: 'Hlavní',
        exercises: exerciseIds.map((instanceId, i) => ({
          exerciseId: instanceId,
          exerciseExternalId: `ext-${i + 1}`,
          exerciseName: `Exercise ${i + 1}`,
          sets: [{ setNumber: 1, reps: 10 }],
        })),
      },
    ],
    standaloneExercises: [],
  }
}

/** Flattens every trackable exercise instance across a session's workouts and standalone exercises. */
function allTrackableInstances(session: TrainingSession): SessionExercise[] {
  const fromWorkouts = (session.workouts ?? []).flatMap((w) => w.exercises ?? [])
  const fromStandalone = session.standaloneExercises ?? []
  return [...fromWorkouts, ...fromStandalone].filter((e) => e.exerciseId != null)
}

const EMPTY_SET = new Set<string>()

// ─── Multi-session aggregation ────────────────────────────────────────────────

describe('multi-session completion aggregation', () => {
  const sessions = [
    makeSession('s1', ['inst-1', 'inst-2']),
    makeSession('s2', ['inst-3', 'inst-4', 'inst-5']),
  ]

  it('aggregates total exercise count across sessions', () => {
    const total = sessions.reduce((sum, s) => sum + allTrackableInstances(s).length, 0)
    expect(total).toBe(5)
  })

  it('aggregates completed count across sessions', () => {
    const completedBySession: Record<string, ReadonlySet<string>> = {
      s1: new Set(['inst-1']),
      s2: new Set(['inst-3', 'inst-5']),
    }
    const done = sessions.reduce((sum, s) => {
      const ids = completedBySession[s.sessionId ?? ''] ?? new Set<string>()
      return sum + ids.size
    }, 0)
    expect(done).toBe(3)
  })

  it('deriveSessionCtaState handles each session independently', () => {
    const s1State = deriveSessionCtaState(sessions[0]!, EMPTY_SET, EMPTY_SET)
    const s2State = deriveSessionCtaState(sessions[1]!, new Set(['inst-3', 'inst-4', 'inst-5']), EMPTY_SET)

    expect(s1State).toBe('not-started')
    expect(s2State).toBe('finished')
  })

  it('returns not-started when completedExerciseInstanceIds is empty', () => {
    for (const session of sessions) {
      const state = deriveSessionCtaState(session, EMPTY_SET, EMPTY_SET)
      expect(state).toBe('not-started')
    }
  })

  it('handles an empty sessions array gracefully', () => {
    const emptySessions: TrainingSession[] = []
    const total = emptySessions.reduce((sum, s) => sum + allTrackableInstances(s).length, 0)
    expect(total).toBe(0)
  })
})

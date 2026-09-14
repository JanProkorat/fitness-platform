/**
 * Unit tests for trainingCardFormat — pure functions, no RN dependencies.
 */

import { getOrderedSessionItems } from '../trainingCardFormat'
import type { TrainingSession } from '@/api/training'

describe('getOrderedSessionItems', () => {
  it('returns workouts and standalone exercises interleaved by order', () => {
    // Mirrors the QA dual-placement fixture: workout order=0, standalone order=1,
    // and the workout's OWN nested exercise also happens to carry order=1 —
    // that nested order must never enter the session-level merge.
    const session: TrainingSession = {
      sessionId: 'sess-1',
      name: 'Push Day',
      workouts: [
        {
          workoutId: 'w1',
          order: 0,
          name: 'Hlavní',
          exercises: [
            { exerciseId: 'inst-nested', exerciseExternalId: 'ex-1', exerciseName: 'Bench Press', order: 1, sets: [] },
          ],
        },
      ],
      standaloneExercises: [
        { exerciseId: 'inst-standalone', exerciseExternalId: 'ex-2', exerciseName: 'Plank', order: 1, sets: [] },
      ],
    }

    const result = getOrderedSessionItems(session)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ isStandalone: false, itemId: 'w1', order: 0, name: 'Hlavní' })
    expect(result[1]).toMatchObject({ isStandalone: true, itemId: 'inst-standalone', order: 1, name: 'Plank' })
    // The nested exercise must appear only inside the workout item's own
    // exercises array — never as a top-level session item.
    expect(result[0].exercises).toHaveLength(1)
    expect(result[0].exercises[0].exerciseId).toBe('inst-nested')
  })

  it('wraps a lone standalone exercise as a single-exercise item', () => {
    const session: TrainingSession = {
      sessionId: 'sess-2',
      name: 'Finisher',
      workouts: [],
      standaloneExercises: [
        { exerciseId: 'inst-1', exerciseExternalId: 'ex-1', exerciseName: 'Burpees', order: 0, sets: [] },
      ],
    }

    const result = getOrderedSessionItems(session)

    expect(result).toEqual([
      {
        isStandalone: true,
        itemId: 'inst-1',
        order: 0,
        name: 'Burpees',
        format: undefined,
        formatConfig: undefined,
        notes: undefined,
        exercises: session.standaloneExercises,
      },
    ])
  })

  it('returns an empty array when there are neither workouts nor standalone exercises', () => {
    const session: TrainingSession = { sessionId: 'sess-3', name: 'Empty', workouts: [], standaloneExercises: [] }

    const result = getOrderedSessionItems(session)
    expect(result).toEqual([])
  })

  it('returns an empty array when workouts and standaloneExercises are both undefined', () => {
    const session: TrainingSession = { sessionId: 'sess-4', name: 'Undefined' }

    const result = getOrderedSessionItems(session)
    expect(result).toEqual([])
  })

  it('sorts multiple workouts and standalone exercises into one shared order sequence', () => {
    const session: TrainingSession = {
      sessionId: 'sess-5',
      name: 'Mixed',
      workouts: [
        { workoutId: 'w-late', order: 2, name: 'Cool-down', exercises: [] },
        { workoutId: 'w-early', order: 0, name: 'Warm-up', exercises: [] },
      ],
      standaloneExercises: [
        { exerciseId: 'inst-mid', exerciseExternalId: 'ex-mid', exerciseName: 'Finisher', order: 1, sets: [] },
      ],
    }

    const result = getOrderedSessionItems(session)

    expect(result.map((item) => item.itemId)).toEqual(['w-early', 'inst-mid', 'w-late'])
  })
})

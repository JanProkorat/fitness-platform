/**
 * Unit tests for trainingCardFormat — pure functions, no RN dependencies.
 */

import { getEffectiveSections } from '../trainingCardFormat'
import type { TrainingSession } from '@/api/training'

const t = (key: string) => key

describe('getEffectiveSections', () => {
  it('returns session.sections unchanged when non-empty', () => {
    const session: TrainingSession = {
      sessionId: 'sess-1',
      name: 'Push Day',
      sections: [
        {
          sectionId: 'sec-1',
          name: 'Hlavní',
          exercises: [
            { exerciseExternalId: 'ex-1', exerciseName: 'Bench Press', sets: [] },
          ],
        },
      ],
      exercises: [],
    }

    const result = getEffectiveSections(session, t)
    expect(result).toBe(session.sections)
  })

  it('synthesizes a single default section when there are no sections but flat exercises exist', () => {
    const flatExercises = [
      { exerciseExternalId: 'ex-1', exerciseName: 'Squat', sets: [] },
      { exerciseExternalId: 'ex-2', exerciseName: 'Deadlift', sets: [] },
    ]
    const session: TrainingSession = {
      sessionId: 'sess-2',
      name: 'Legacy Flat Plan',
      sections: [],
      exercises: flatExercises,
    }

    const result = getEffectiveSections(session, t)

    expect(result).toEqual([
      {
        sectionId: 'default',
        order: 0,
        name: 'training.section.defaultName',
        format: undefined,
        formatConfig: undefined,
        exercises: flatExercises,
      },
    ])
  })

  it('returns an empty array when there are neither sections nor exercises', () => {
    const session: TrainingSession = {
      sessionId: 'sess-3',
      name: 'Empty',
      sections: [],
      exercises: [],
    }

    const result = getEffectiveSections(session, t)
    expect(result).toEqual([])
  })

  it('returns an empty array when sections and exercises are both undefined', () => {
    const session: TrainingSession = {
      sessionId: 'sess-4',
      name: 'Undefined',
    }

    const result = getEffectiveSections(session, t)
    expect(result).toEqual([])
  })
})

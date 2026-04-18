/**
 * Unit tests for liveSessionStore.
 *
 * NOTE: These tests require a jest + jest-expo (or equivalent) setup that is
 * not yet present in the mobile package. The mobile/package.json has no
 * "jest" field and no jest.config.* file. The tests are written to be
 * runnable once jest is added — no new runner is introduced here.
 *
 * Required setup (blocked, do not add without orchestrator approval):
 *   - jest-expo preset (or bare jest with babel-jest + react-native preset)
 *   - A mock for react-native-mmkv (see __mocks__ below)
 *   - A mock for zustand/react (already plain JS — no DOM needed)
 *
 * To run once jest is configured:
 *   cd mobile && npx jest src/stores/__tests__/liveSessionStore.test.ts
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Inline mock for react-native-mmkv so tests run in a Node environment.
// In a proper jest setup this would live in mobile/__mocks__/react-native-mmkv.ts
// or be registered via moduleNameMapper.

const _mmkvStore: Record<string, string> = {}

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => _mmkvStore[key] ?? undefined,
    set: (key: string, value: string) => { _mmkvStore[key] = value },
    remove: (key: string) => { delete _mmkvStore[key] },
  }),
}))

// ─── Subject under test ───────────────────────────────────────────────────────

// Import after mocks are registered.
import { useLiveSessionStore } from '../liveSessionStore'

// Helper: reset store + MMKV between tests.
function resetAll() {
  // Clear the in-memory MMKV mock.
  Object.keys(_mmkvStore).forEach((k) => { delete _mmkvStore[k] })
  // Reset Zustand store to initial state via discard().
  useLiveSessionStore.getState().discard()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('liveSessionStore', () => {
  beforeEach(resetAll)

  // ── start() ────────────────────────────────────────────────────────────────

  describe('start()', () => {
    it('seeds the correct initial state', () => {
      const store = useLiveSessionStore.getState()
      store.start({ sessionId: 'sess-1' }, 'log-abc', 'plan-xyz')

      const s = useLiveSessionStore.getState()
      expect(s.activeLogId).toBe('log-abc')
      expect(s.planId).toBe('plan-xyz')
      expect(s.sessionId).toBe('sess-1')
      expect(s.startedAt).not.toBeNull()
      expect(s.currentExerciseIdx).toBe(0)
      expect(s.currentSetIdx).toBe(0)
      expect(s.completedSets).toEqual({})
      expect(s.skippedSets).toEqual({})
      expect(s.skippedExercises).toEqual([])
      expect(s.restStartedAt).toBeNull()
      expect(s.restSeconds).toBeNull()
      expect(s.finishedAt).toBeNull()
      expect(s.formOverrides).toEqual({})
    })

    it('writes the session to MMKV', () => {
      useLiveSessionStore.getState().start({ sessionId: 'sess-1' }, 'log-abc', 'plan-xyz')
      const raw = _mmkvStore['session']
      expect(raw).toBeDefined()
      const parsed = JSON.parse(raw)
      expect(parsed.activeLogId).toBe('log-abc')
      expect(parsed.sessionId).toBe('sess-1')
    })

    it('hasActiveSession() returns true right after start', () => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
      expect(useLiveSessionStore.getState().hasActiveSession()).toBe(true)
    })
  })

  // ── markSetDone() ──────────────────────────────────────────────────────────

  describe('markSetDone()', () => {
    beforeEach(() => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    it('records a completed set index', () => {
      useLiveSessionStore.getState().markSetDone('ex-1', 0)
      expect(useLiveSessionStore.getState().completedSets['ex-1']).toEqual([0])
    })

    it('accumulates multiple completed sets and keeps them sorted', () => {
      const store = useLiveSessionStore.getState()
      store.markSetDone('ex-1', 2)
      store.markSetDone('ex-1', 0)
      store.markSetDone('ex-1', 1)
      expect(useLiveSessionStore.getState().completedSets['ex-1']).toEqual([0, 1, 2])
    })

    it('does not duplicate a set index already recorded', () => {
      const store = useLiveSessionStore.getState()
      store.markSetDone('ex-1', 0)
      store.markSetDone('ex-1', 0)
      expect(useLiveSessionStore.getState().completedSets['ex-1']).toEqual([0])
    })

    it('stores form overrides when actuals are provided', () => {
      useLiveSessionStore.getState().markSetDone('ex-1', 0, { reps: 12, weightKg: 80 })
      expect(useLiveSessionStore.getState().formOverrides['ex-1'][0]).toEqual({
        reps: 12,
        weightKg: 80,
      })
    })

    it('stores partial form overrides (reps only)', () => {
      useLiveSessionStore.getState().markSetDone('ex-1', 0, { reps: 10 })
      expect(useLiveSessionStore.getState().formOverrides['ex-1'][0]).toEqual({ reps: 10 })
    })

    it('leaves prior completedSets for other exercises intact', () => {
      const store = useLiveSessionStore.getState()
      store.markSetDone('ex-1', 0)
      store.markSetDone('ex-2', 1)
      const s = useLiveSessionStore.getState()
      expect(s.completedSets['ex-1']).toEqual([0])
      expect(s.completedSets['ex-2']).toEqual([1])
    })
  })

  // ── skipSet() ──────────────────────────────────────────────────────────────

  describe('skipSet()', () => {
    beforeEach(() => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    it('records skipped set index', () => {
      useLiveSessionStore.getState().skipSet('ex-1', 1)
      expect(useLiveSessionStore.getState().skippedSets['ex-1']).toEqual([1])
    })

    it('does not affect completedSets', () => {
      const store = useLiveSessionStore.getState()
      store.markSetDone('ex-1', 0)
      store.skipSet('ex-1', 1)
      const s = useLiveSessionStore.getState()
      expect(s.completedSets['ex-1']).toEqual([0])
      expect(s.skippedSets['ex-1']).toEqual([1])
    })

    it('keeps skipped indices sorted', () => {
      const store = useLiveSessionStore.getState()
      store.skipSet('ex-1', 2)
      store.skipSet('ex-1', 0)
      expect(useLiveSessionStore.getState().skippedSets['ex-1']).toEqual([0, 2])
    })
  })

  // ── skipExercise() ────────────────────────────────────────────────────────

  describe('skipExercise()', () => {
    beforeEach(() => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    it('adds the exercise to skippedExercises', () => {
      useLiveSessionStore.getState().skipExercise('ex-2')
      expect(useLiveSessionStore.getState().skippedExercises).toContain('ex-2')
    })

    it('does not duplicate already-skipped exercises', () => {
      const store = useLiveSessionStore.getState()
      store.skipExercise('ex-2')
      store.skipExercise('ex-2')
      expect(useLiveSessionStore.getState().skippedExercises.filter((e) => e === 'ex-2')).toHaveLength(1)
    })

    it('leaves prior completedSets for other exercises intact', () => {
      const store = useLiveSessionStore.getState()
      store.markSetDone('ex-1', 0)
      store.markSetDone('ex-1', 1)
      store.skipExercise('ex-2')
      expect(useLiveSessionStore.getState().completedSets['ex-1']).toEqual([0, 1])
    })
  })

  // ── Rest-timer drift ──────────────────────────────────────────────────────

  describe('rest-timer wall-clock drift', () => {
    const BASE_TIME = new Date('2024-01-01T12:00:00.000Z').getTime()

    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(BASE_TIME)
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('computes ~30 s remaining after 60 s of a 90 s rest', () => {
      useLiveSessionStore.getState().startRest(90)
      const { restStartedAt, restSeconds } = useLiveSessionStore.getState()

      // Advance wall clock by 60 s.
      jest.setSystemTime(BASE_TIME + 60_000)

      const remaining = restSeconds! - (Date.now() - Date.parse(restStartedAt!)) / 1000
      expect(remaining).toBeCloseTo(30, 0)
    })

    it('computes ≤ 0 remaining after 105 s (60 + 45) of a 90 s rest', () => {
      useLiveSessionStore.getState().startRest(90)
      const { restStartedAt, restSeconds } = useLiveSessionStore.getState()

      // Advance by 105 s (60 + 45).
      jest.setSystemTime(BASE_TIME + 105_000)

      const remaining = restSeconds! - (Date.now() - Date.parse(restStartedAt!)) / 1000
      expect(remaining).toBeLessThanOrEqual(0)
    })

    it('persists restStartedAt as an ISO string', () => {
      useLiveSessionStore.getState().startRest(60)
      const { restStartedAt } = useLiveSessionStore.getState()
      expect(() => new Date(restStartedAt!)).not.toThrow()
      expect(new Date(restStartedAt!).getTime()).toBe(BASE_TIME)
    })
  })

  // ── finish() ──────────────────────────────────────────────────────────────

  describe('finish()', () => {
    beforeEach(() => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    it('sets finishedAt to a non-null ISO string', () => {
      useLiveSessionStore.getState().finish()
      const { finishedAt } = useLiveSessionStore.getState()
      expect(finishedAt).not.toBeNull()
      expect(() => new Date(finishedAt!)).not.toThrow()
    })

    it('makes hasActiveSession() return false', () => {
      useLiveSessionStore.getState().finish()
      expect(useLiveSessionStore.getState().hasActiveSession()).toBe(false)
    })

    it('clears rest fields', () => {
      const store = useLiveSessionStore.getState()
      store.startRest(90)
      store.finish()
      const s = useLiveSessionStore.getState()
      expect(s.restStartedAt).toBeNull()
      expect(s.restSeconds).toBeNull()
    })

    it('persists finishedAt to MMKV', () => {
      useLiveSessionStore.getState().finish()
      const raw = _mmkvStore['session']
      expect(raw).toBeDefined()
      const parsed = JSON.parse(raw)
      expect(parsed.finishedAt).not.toBeNull()
    })
  })

  // ── discard() ─────────────────────────────────────────────────────────────

  describe('discard()', () => {
    it('clears the MMKV key', () => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
      expect(_mmkvStore['session']).toBeDefined()
      useLiveSessionStore.getState().discard()
      expect(_mmkvStore['session']).toBeUndefined()
    })

    it('resets in-memory state to initial values', () => {
      const store = useLiveSessionStore.getState()
      store.start({ sessionId: 's' }, 'l', 'p')
      store.markSetDone('ex-1', 0)
      store.discard()

      const s = useLiveSessionStore.getState()
      expect(s.activeLogId).toBeNull()
      expect(s.sessionId).toBeNull()
      expect(s.completedSets).toEqual({})
      expect(s.startedAt).toBeNull()
      expect(s.finishedAt).toBeNull()
    })

    it('makes hasActiveSession() return false', () => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
      useLiveSessionStore.getState().discard()
      expect(useLiveSessionStore.getState().hasActiveSession()).toBe(false)
    })
  })

  // ── hasActiveSession() ────────────────────────────────────────────────────

  describe('hasActiveSession()', () => {
    it('returns false when there is no active log', () => {
      expect(useLiveSessionStore.getState().hasActiveSession()).toBe(false)
    })

    it('returns true between start() and finish()', () => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
      expect(useLiveSessionStore.getState().hasActiveSession()).toBe(true)
    })

    it('returns false after finish()', () => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
      useLiveSessionStore.getState().finish()
      expect(useLiveSessionStore.getState().hasActiveSession()).toBe(false)
    })
  })

  // ── advance() + skipRest() ────────────────────────────────────────────────

  describe('advance()', () => {
    beforeEach(() => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    it('updates currentExerciseIdx and currentSetIdx', () => {
      useLiveSessionStore.getState().advance(1, 0)
      const s = useLiveSessionStore.getState()
      expect(s.currentExerciseIdx).toBe(1)
      expect(s.currentSetIdx).toBe(0)
    })

    it('persists new indices to MMKV', () => {
      useLiveSessionStore.getState().advance(2, 1)
      const parsed = JSON.parse(_mmkvStore['session'])
      expect(parsed.currentExerciseIdx).toBe(2)
      expect(parsed.currentSetIdx).toBe(1)
    })
  })

  describe('skipRest()', () => {
    beforeEach(() => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    it('clears rest fields', () => {
      useLiveSessionStore.getState().startRest(60)
      useLiveSessionStore.getState().skipRest()
      const s = useLiveSessionStore.getState()
      expect(s.restStartedAt).toBeNull()
      expect(s.restSeconds).toBeNull()
    })
  })
})

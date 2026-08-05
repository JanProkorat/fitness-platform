/**
 * Unit tests for liveSessionStore.
 *
 * jest + jest-expo are configured via the "jest" field in mobile/package.json.
 * Run with:
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

    // stores/auth.ts logout() dynamically imports this store and calls
    // discard() so a subsequent user's session never inherits a previous
    // user's in-progress WOD/rest/form-override state. Assert discard()
    // fully restores every field (not just the handful the tests above
    // sample) so that logout-reset contract stays covered.
    it('resets every field to its initial value (the logout-reset contract)', () => {
      const store = useLiveSessionStore.getState()
      store.start({ sessionId: 's' }, 'l', 'p')
      store.markSetDone('ex-1', 0, { reps: 10, weightKg: 50 })
      store.skipSet('ex-1', 1)
      store.skipExercise('ex-2')
      store.startRest(60)
      store.advance(2, 1)
      store.advanceSection(1)
      store.recordRound('sect-1')
      store.markRoundFailed('sect-1', 1)
      store.setExtraReps('sect-1', 5)
      store.finalizeWod('sect-1', { roundsCompleted: 3 })

      store.discard()

      expect(useLiveSessionStore.getState()).toEqual({
        _version: 3,
        activeLogId: null,
        planId: null,
        sessionId: null,
        startedAt: null,
        currentExerciseIdx: 0,
        currentSetIdx: 0,
        currentSectionIdx: null,
        completedSets: {},
        skippedSets: {},
        skippedExercises: [],
        restStartedAt: null,
        restSeconds: null,
        finishedAt: null,
        formOverrides: {},
        wodResults: {},
        // Action functions carry over unchanged — assert their presence
        // without pinning identity.
        start: expect.any(Function),
        markSetDone: expect.any(Function),
        skipSet: expect.any(Function),
        skipExercise: expect.any(Function),
        startRest: expect.any(Function),
        skipRest: expect.any(Function),
        advance: expect.any(Function),
        advanceSection: expect.any(Function),
        close: expect.any(Function),
        resume: expect.any(Function),
        finish: expect.any(Function),
        discard: expect.any(Function),
        hasActiveSession: expect.any(Function),
        recordRound: expect.any(Function),
        markRoundFailed: expect.any(Function),
        setExtraReps: expect.any(Function),
        finalizeWod: expect.any(Function),
      })
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

  // ── advanceSection() ──────────────────────────────────────────────────────

  describe('advanceSection()', () => {
    beforeEach(() => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    it('sets currentSectionIdx and resets exercise/set indices to 0', () => {
      useLiveSessionStore.getState().advance(3, 2)
      useLiveSessionStore.getState().advanceSection(1)
      const s = useLiveSessionStore.getState()
      expect(s.currentSectionIdx).toBe(1)
      expect(s.currentExerciseIdx).toBe(0)
      expect(s.currentSetIdx).toBe(0)
    })

    it('persists the new section index to MMKV', () => {
      useLiveSessionStore.getState().advanceSection(2)
      const parsed = JSON.parse(_mmkvStore['session'])
      expect(parsed.currentSectionIdx).toBe(2)
    })

    it('leaves completedSets and wodResults untouched', () => {
      const store = useLiveSessionStore.getState()
      store.markSetDone('ex-1', 0)
      store.finalizeWod('sect-0', { roundsCompleted: 4 })
      store.advanceSection(1)
      const s = useLiveSessionStore.getState()
      expect(s.completedSets['ex-1']).toEqual([0])
      expect(s.wodResults['sect-0']).toEqual({ roundsCompleted: 4 })
    })
  })

  // ── WOD-result actions ────────────────────────────────────────────────────

  describe('recordRound()', () => {
    beforeEach(() => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    it('starts roundsCompleted at 1 for a new key', () => {
      useLiveSessionStore.getState().recordRound('sect-1')
      expect(useLiveSessionStore.getState().wodResults['sect-1'].roundsCompleted).toBe(1)
    })

    it('increments roundsCompleted on repeated calls', () => {
      const store = useLiveSessionStore.getState()
      store.recordRound('sect-1')
      store.recordRound('sect-1')
      store.recordRound('sect-1')
      expect(useLiveSessionStore.getState().wodResults['sect-1'].roundsCompleted).toBe(3)
    })

    it('keeps separate counters per key', () => {
      const store = useLiveSessionStore.getState()
      store.recordRound('sect-1')
      store.recordRound('sect-2')
      store.recordRound('sect-2')
      const s = useLiveSessionStore.getState()
      expect(s.wodResults['sect-1'].roundsCompleted).toBe(1)
      expect(s.wodResults['sect-2'].roundsCompleted).toBe(2)
    })
  })

  describe('markRoundFailed()', () => {
    beforeEach(() => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    it('adds the round number to failedRounds', () => {
      useLiveSessionStore.getState().markRoundFailed('sect-1', 2)
      expect(useLiveSessionStore.getState().wodResults['sect-1'].failedRounds).toEqual([2])
    })

    it('toggles the round off when marked failed twice', () => {
      const store = useLiveSessionStore.getState()
      store.markRoundFailed('sect-1', 2)
      store.markRoundFailed('sect-1', 2)
      expect(useLiveSessionStore.getState().wodResults['sect-1'].failedRounds).toEqual([])
    })

    it('keeps failedRounds sorted', () => {
      const store = useLiveSessionStore.getState()
      store.markRoundFailed('sect-1', 3)
      store.markRoundFailed('sect-1', 1)
      expect(useLiveSessionStore.getState().wodResults['sect-1'].failedRounds).toEqual([1, 3])
    })
  })

  describe('setExtraReps()', () => {
    beforeEach(() => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    it('sets extraReps for the given key', () => {
      useLiveSessionStore.getState().setExtraReps('sect-1', 7)
      expect(useLiveSessionStore.getState().wodResults['sect-1'].extraReps).toBe(7)
    })

    it('overwrites a previous value for the same key', () => {
      const store = useLiveSessionStore.getState()
      store.setExtraReps('sect-1', 7)
      store.setExtraReps('sect-1', 12)
      expect(useLiveSessionStore.getState().wodResults['sect-1'].extraReps).toBe(12)
    })

    it('preserves other fields already set on the same key', () => {
      const store = useLiveSessionStore.getState()
      store.recordRound('sect-1')
      store.setExtraReps('sect-1', 4)
      const result = useLiveSessionStore.getState().wodResults['sect-1']
      expect(result.roundsCompleted).toBe(1)
      expect(result.extraReps).toBe(4)
    })
  })

  describe('finalizeWod()', () => {
    beforeEach(() => {
      useLiveSessionStore.getState().start({ sessionId: 's' }, 'l', 'p')
    })

    it('writes the full WodResult for the given key', () => {
      useLiveSessionStore.getState().finalizeWod('sect-1', { roundsCompleted: 5, extraReps: 10 })
      expect(useLiveSessionStore.getState().wodResults['sect-1']).toEqual({
        roundsCompleted: 5,
        extraReps: 10,
      })
    })

    it('replaces any prior in-progress result for the same key', () => {
      const store = useLiveSessionStore.getState()
      store.recordRound('sect-1')
      store.markRoundFailed('sect-1', 1)
      store.finalizeWod('sect-1', { roundsCompleted: 9 })
      expect(useLiveSessionStore.getState().wodResults['sect-1']).toEqual({ roundsCompleted: 9 })
    })

    it('persists the result to MMKV', () => {
      useLiveSessionStore.getState().finalizeWod('sect-1', { roundsCompleted: 2 })
      const parsed = JSON.parse(_mmkvStore['session'])
      expect(parsed.wodResults['sect-1']).toEqual({ roundsCompleted: 2 })
    })

    it('does not affect other keys', () => {
      const store = useLiveSessionStore.getState()
      store.finalizeWod('sect-1', { roundsCompleted: 2 })
      store.finalizeWod('sect-2', { roundsCompleted: 6 })
      const s = useLiveSessionStore.getState()
      expect(s.wodResults['sect-1']).toEqual({ roundsCompleted: 2 })
      expect(s.wodResults['sect-2']).toEqual({ roundsCompleted: 6 })
    })
  })
})

// ── migrateState() version migration (v1 → v2 → v3) ─────────────────────────
//
// The store reads + migrates persisted state once, at module-eval time
// (getPersistedSession() runs inside the create() initializer). To exercise
// migrateState() with an older-shaped MMKV blob already on disk, we must
// seed the mock MMKV *before* a fresh module instance evaluates, via
// jest.isolateModules() + require() (resetModules() alone would not help,
// since the outer `useLiveSessionStore` import at the top of this file has
// already run its module-level initializer).

describe('migrateState() version migration', () => {
  beforeEach(() => {
    Object.keys(_mmkvStore).forEach((k) => { delete _mmkvStore[k] })
  })

  it('migrates a v1 blob all the way to v3, dropping wodResults entirely', () => {
    _mmkvStore['session'] = JSON.stringify({
      _version: 1,
      activeLogId: 'log-1',
      planId: 'plan-1',
      sessionId: 'sess-1',
      startedAt: '2024-01-01T00:00:00.000Z',
      currentExerciseIdx: 0,
      currentSetIdx: 0,
      completedSets: {},
      skippedSets: {},
      skippedExercises: [],
      restStartedAt: null,
      restSeconds: null,
      finishedAt: null,
      formOverrides: {},
      wodResults: {
        // The v1 sentinel would be dropped by the v1→v2 step alone, but the
        // v2→v3 step drops the whole map regardless (workoutId/exerciseId
        // cannot be derived from a catalog id or a retired sectionId
        // without the plan tree at migration time).
        '__legacySentinelKey123': { roundsCompleted: 3 },
        'section-real': { roundsCompleted: 5 },
      },
    })

    let fresh: typeof import('../liveSessionStore') | undefined
    jest.isolateModules(() => {
      fresh = require('../liveSessionStore')
    })

    const state = fresh!.useLiveSessionStore.getState()
    expect(state._version).toBe(3)
    expect(state.wodResults).toEqual({})
    expect(state.currentSectionIdx).toBeNull()
  })

  it('treats a persisted blob with no _version field as v1 and migrates it to v3', () => {
    _mmkvStore['session'] = JSON.stringify({
      activeLogId: 'log-1',
      planId: 'plan-1',
      sessionId: 'sess-1',
      startedAt: null,
      currentExerciseIdx: 0,
      currentSetIdx: 0,
      completedSets: {},
      skippedSets: {},
      skippedExercises: [],
      restStartedAt: null,
      restSeconds: null,
      finishedAt: null,
      formOverrides: {},
      wodResults: { '__oldSentinel': { roundsCompleted: 1 } },
    })

    let fresh: typeof import('../liveSessionStore') | undefined
    jest.isolateModules(() => {
      fresh = require('../liveSessionStore')
    })

    const state = fresh!.useLiveSessionStore.getState()
    expect(state._version).toBe(3)
    expect(state.wodResults).toEqual({})
  })

  it('migrates a v2 blob to v3, dropping wodResults (the sectionId half of the key space has no 1:1 mapping to the new workoutId space)', () => {
    _mmkvStore['session'] = JSON.stringify({
      _version: 2,
      activeLogId: 'log-1',
      planId: 'plan-1',
      sessionId: 'sess-1',
      startedAt: null,
      currentExerciseIdx: 0,
      currentSetIdx: 0,
      currentSectionIdx: 1,
      completedSets: { 'ex-1': [0, 1] },
      skippedSets: {},
      skippedExercises: [],
      restStartedAt: null,
      restSeconds: null,
      finishedAt: null,
      formOverrides: {},
      wodResults: { 'section-real': { roundsCompleted: 5 } },
    })

    let fresh: typeof import('../liveSessionStore') | undefined
    jest.isolateModules(() => {
      fresh = require('../liveSessionStore')
    })

    const state = fresh!.useLiveSessionStore.getState()
    expect(state._version).toBe(3)
    // currentSectionIdx and the catalog-keyed live-log maps (completedSets
    // etc.) carry over unchanged — only wodResults' meaning changed.
    expect(state.currentSectionIdx).toBe(1)
    expect(state.completedSets).toEqual({ 'ex-1': [0, 1] })
    expect(state.wodResults).toEqual({})
  })

  it('leaves an already-current (v3) blob untouched', () => {
    _mmkvStore['session'] = JSON.stringify({
      _version: 3,
      activeLogId: 'log-1',
      planId: 'plan-1',
      sessionId: 'sess-1',
      startedAt: null,
      currentExerciseIdx: 0,
      currentSetIdx: 0,
      currentSectionIdx: 1,
      completedSets: {},
      skippedSets: {},
      skippedExercises: [],
      restStartedAt: null,
      restSeconds: null,
      finishedAt: null,
      formOverrides: {},
      wodResults: { 'workout-real': { roundsCompleted: 5 } },
    })

    let fresh: typeof import('../liveSessionStore') | undefined
    jest.isolateModules(() => {
      fresh = require('../liveSessionStore')
    })

    const state = fresh!.useLiveSessionStore.getState()
    expect(state._version).toBe(3)
    expect(state.currentSectionIdx).toBe(1)
    expect(state.wodResults).toEqual({ 'workout-real': { roundsCompleted: 5 } })
  })
})

/**
 * Unit tests for useDiaryRequestState's three-way state derivation (#798,
 * root-caused in #782).
 *
 * `deriveDiaryRequestState` is exported specifically so this derivation can
 * be tested without rendering the hook itself — this package has no
 * `@testing-library/react`-style hook-rendering harness wired up (only
 * `jest-expo` + `react-test-renderer`, per the precedent in
 * `useImagePicker.test.ts`). The pure function takes exactly the flags
 * `useDiaryRequestState`'s internal `useQuery` call produces
 * (`isPending`, `isError`) plus `requestId`/`planId`, so exercising it here
 * covers the same branches the hook would hit at runtime.
 *
 * Branches covered (per the design review's error_paths):
 *   1. loading         — query still pending, requestId present
 *   2. requestFailed    (a) query settled with an error
 *                        (b) requestId absent — query is enabled:false and
 *                            never settles, isPending stays true forever
 *   3. missingPlan      — query settled successfully, no planId on the request
 *   4. ready            — query settled successfully with a planId
 *
 * To run:
 *   cd mobile && npx jest src/hooks/__tests__/useDiaryRequestState.test.ts
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

// useDiaryRequestState.ts pulls in `@/api/diaryRequests` -> `@/api/client` ->
// `@/stores/auth` -> `react-native-mmkv`, which requires the NitroModules
// native module and is not available in the Jest/Node environment (same gap
// documented in liveSessionStore.test.ts). We only need the pure
// `deriveDiaryRequestState` export here, not anything MMKV-backed, so a
// minimal inline mock is enough to let the import chain resolve.
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => undefined,
    set: () => {},
    remove: () => {},
  }),
}));

import { deriveDiaryRequestState } from '../useDiaryRequestState';

describe('deriveDiaryRequestState', () => {
  it('loading: requestId present, query still pending — neither failed nor missingPlan', () => {
    const result = deriveDiaryRequestState('req-1', undefined, true, false);
    expect(result.requestFailed).toBe(false);
    expect(result.missingPlan).toBe(false);
  });

  it('requestFailed: query settled with an error', () => {
    const result = deriveDiaryRequestState('req-1', undefined, false, true);
    expect(result.requestFailed).toBe(true);
    expect(result.missingPlan).toBe(false);
  });

  it('requestFailed: requestId absent — query never settles (isPending stays true)', () => {
    // Mirrors the enabled:!!requestId contract: with no requestId the query
    // is permanently enabled:false, so isPending is true forever and
    // isError is false. Must still surface as requestFailed, not loading.
    const result = deriveDiaryRequestState(undefined, undefined, true, false);
    expect(result.requestFailed).toBe(true);
    expect(result.missingPlan).toBe(false);
  });

  it('missingPlan: query settled successfully but the request has no planId', () => {
    const result = deriveDiaryRequestState('req-1', undefined, false, false);
    expect(result.requestFailed).toBe(false);
    expect(result.missingPlan).toBe(true);
  });

  it('ready: query settled successfully with a planId — neither failed nor missingPlan', () => {
    const result = deriveDiaryRequestState('req-1', 'plan-1', false, false);
    expect(result.requestFailed).toBe(false);
    expect(result.missingPlan).toBe(false);
  });

  it('requestFailed takes precedence over missingPlan when both requestId is absent and planId is undefined', () => {
    // Defensive: an error state should never also read as "no plan attached"
    // -- the error/missing-param message must win.
    const result = deriveDiaryRequestState(undefined, undefined, false, true);
    expect(result.requestFailed).toBe(true);
    expect(result.missingPlan).toBe(false);
  });
});

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
 * A 7th test below exercises `useDiaryRequestState` itself (not the pure
 * derivation) via a minimal `react-test-renderer` harness, specifically to
 * lock in the `isLoading` !== `isPending` guardrail as a suite-enforced
 * fact rather than a comment — see that test's own doc block for exactly
 * what it does and does not cover.
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

// ─── Hook wiring (not just the pure derivation) ───────────────────────────────
//
// The 6 tests above exercise `deriveDiaryRequestState` directly — they would
// stay green even if `useDiaryRequestState` itself passed the wrong flag
// (e.g. `query.isPending` where `query.isLoading` belongs) into its returned
// `isLoading` field, because the pure function never sees that wiring at all.
// The `workflow.tsx` full-screen gate reads `isLoading` off this hook's
// return value directly, so that specific wiring is exactly what needs
// suite-level protection, per the guardrail documented on the hook itself.
//
// This package has no `@testing-library/react`-style `renderHook` harness,
// so the hook is exercised via a minimal `react-test-renderer` mount: a
// throwaway component calls the real hook inside a real `QueryClientProvider`
// and reports the result out through a plain callback captured by the test.
// `requestId: undefined` means the query is `enabled: false` and never
// fetches, so a single synchronous render is enough — no `waitFor`/async
// flush is needed.
//
// What this DOES cover: `useDiaryRequestState(undefined, ...)` returns
// `isLoading === false` (never `true`) for a disabled query, i.e. the exact
// case the guardrail comment in `workflow.tsx` and in this hook depends on.
// What this does NOT cover: the `requestId`-present branches (loading /
// requestFailed-by-error / missingPlan / ready with a real fetch resolving)
// — those still route only through `deriveDiaryRequestState` above, since
// driving a real network-backed `useQuery` to each of those states would
// need fake timers / mocked `getDiaryRequestById` resolution, which is out
// of scope for locking down this one guardrail.
describe('useDiaryRequestState (hook wiring)', () => {
  it('returns isLoading === false when requestId is undefined (query is enabled:false)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');
    // react-test-renderer ships no type declarations and this repo has no
    // @types/react-test-renderer package installed; it is already a
    // transitive dependency (via jest-expo) so no new dependency is added.
    // require() resolves to `any` here (via @types/node's NodeRequire), so
    // no ts-expect-error suppression is needed.
    const TestRenderer = require('react-test-renderer');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useDiaryRequestState } = require('../useDiaryRequestState');

    let captured: { isLoading: boolean; requestFailed: boolean } | undefined;

    function HookHarness() {
      const state = useDiaryRequestState(undefined, 60_000);
      captured = { isLoading: state.isLoading, requestFailed: state.requestFailed };
      return null;
    }

    const queryClient = new QueryClient();

    TestRenderer.act(() => {
      TestRenderer.create(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(HookHarness),
        ),
      );
    });

    expect(captured).toBeDefined();
    // The guardrail: with requestId undefined the query is enabled:false, so
    // isPending stays true forever -- but isLoading (isPending && isFetching)
    // correctly settles to false. If useDiaryRequestState ever returns
    // isPending mislabeled as isLoading, this assertion catches it.
    expect(captured!.isLoading).toBe(false);
    expect(captured!.requestFailed).toBe(true);
  });
});

/**
 * Shared diary-request query + three-way state derivation.
 *
 * Root cause (#782, re-surfaced on the sibling screen as #798): `planId` is
 * `undefined` in three situations that used to be indistinguishable in the
 * UI — (1) the request query is still loading, (2) `requestId` never arrived
 * as a route param so the query is permanently `enabled: false` and never
 * settles at all, and (3) the query settled but the request has no plan
 * attached (a valid backend state — CreateRequestRequest.PlanId is optional)
 * or the request could not be found. All three used to render the same
 * permanently-disabled `ActivityIndicator` on the "Add photos" card with no
 * way out. Split them: `isPending` covers the transient case (bounded by the
 * default single retry in queryClient.ts); a missing `requestId` or a hard
 * fetch failure are now surfaced with a retry button; `requestSettled &&
 * !planId` covers the terminal "no plan to upload against" case (now an
 * explicit message instead of an infinite spinner).
 *
 * This hook owns the `useQuery` call itself — not just the derived booleans
 * — because splitting `enabled: !!requestId` from the derivation is half of
 * the original bug: a screen that re-implements its own `useQuery` next to
 * a shared derivation helper can still drift (#798 was exactly `bulk.tsx`'s
 * fix never reaching `workflow.tsx`). `bulk.tsx` and `workflow.tsx` both
 * consume this hook so the derivation has exactly one home.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getDiaryRequestById, type ClientPhotoDiaryRequestSummary } from '@/api/diaryRequests'

export interface DiaryRequestState {
  /** The resolved diary request, once the query has settled successfully. */
  request: ClientPhotoDiaryRequestSummary | undefined
  /** Convenience accessor — `request?.planId`. */
  planId: string | undefined
  /**
   * Bounded first-fetch loading state (`isPending && isFetching` under
   * TanStack Query v5). Used by `workflow.tsx` for its full-screen gate —
   * do NOT swap this for `isPending` at that call site: with `requestId`
   * absent the query is `enabled: false`, so `isPending` stays `true`
   * forever while `isLoading` correctly settles to `false`.
   */
  isLoading: boolean
  /**
   * Hard fetch failure (network/server), or `requestId` never arrived as a
   * route param — surfaced with a retry instead of leaving the card
   * spinning forever.
   */
  requestFailed: boolean
  /**
   * Query settled successfully but the request has no plan attached, or the
   * request could not be found. Upload is structurally impossible without a
   * `planId`, so say so explicitly instead of disabling the picker forever
   * with no explanation.
   */
  missingPlan: boolean
  /** Re-issue the query — a no-op while `requestId` is absent (enabled: false). */
  refetch: UseQueryResult<ClientPhotoDiaryRequestSummary | undefined>['refetch']
}

/**
 * Pure derivation of the request/plan state from the query's own
 * settled/error/pending flags — extracted so the three-way split can be
 * unit-tested without a React renderer (this package has no
 * `@testing-library/react`-style hook-rendering harness wired up; see
 * `useDiaryRequestState.test.ts`).
 */
export function deriveDiaryRequestState(
  requestId: string | undefined,
  planId: string | undefined,
  isPending: boolean,
  isError: boolean,
): { requestFailed: boolean; missingPlan: boolean } {
  const requestFailed = isError || !requestId
  const requestSettled = !isPending && !isError
  const missingPlan = requestSettled && !!requestId && !planId
  return { requestFailed, missingPlan }
}

/**
 * Fetches the diary request identified by `requestId` and derives the
 * three-way card state (`requestFailed` / `missingPlan` / ready) that both
 * `bulk.tsx` and `workflow.tsx` render.
 *
 * @param requestId Route param — may be absent (see `missingPlan`/`requestFailed` docs above).
 * @param staleTime Cache staleness window. Each screen preserves its own
 *   pre-existing value — `bulk.tsx` uses 30s, `workflow.tsx` uses 60s — this
 *   divergence is intentional and not something to normalise away.
 */
export function useDiaryRequestState(
  requestId: string | undefined,
  staleTime: number,
): DiaryRequestState {
  const requestQuery = useQuery<ClientPhotoDiaryRequestSummary | undefined>({
    queryKey: ['diary-request', requestId],
    queryFn: () => getDiaryRequestById(requestId ?? ''),
    enabled: !!requestId,
    staleTime,
  })

  const planId = requestQuery.data?.planId
  const { requestFailed, missingPlan } = deriveDiaryRequestState(
    requestId,
    planId,
    requestQuery.isPending,
    requestQuery.isError,
  )

  return {
    request: requestQuery.data,
    planId,
    isLoading: requestQuery.isLoading,
    requestFailed,
    missingPlan,
    refetch: requestQuery.refetch,
  }
}

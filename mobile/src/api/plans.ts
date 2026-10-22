import { api } from '@/api/client';
import type { ClientOwnPlanItem, GetClientPlanSummaryResponse } from '@/api/generated';

export const PLANS_QUERY_KEY = ['plans'] as const;
export const planSummaryQueryKey = (planId: string) => [...PLANS_QUERY_KEY, planId, 'summary'] as const;

/** The summary carries short-lived signed photo URLs (about 15 minutes), so it must go stale well before that. */
export const PLAN_SUMMARY_STALE_TIME_MS = 5 * 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isPlanId = (value: string): boolean => UUID_PATTERN.test(value);

export type PlanKind = 'training' | 'nutrition';

const ACTIVE_STATUS = 'Active';

/** Anything the API returns that is not Active (Completed or Archived) is shown as a finished plan. */
export const isActivePlan = (plan: { status?: string }): boolean => plan.status === ACTIVE_STATUS;

export const planKind = (plan: { type?: string }): PlanKind =>
  plan.type?.toLowerCase() === 'nutrition' ? 'nutrition' : 'training';

/** Every plan of the signed-in client, drafts excluded by the server (GET /client/plans). */
export async function fetchClientPlans(signal?: AbortSignal): Promise<ClientOwnPlanItem[]> {
  const response = await api.getClientPlansEndpoint(undefined, signal);
  return (response.items ?? []).filter((plan) => plan.planId !== undefined);
}

/** Start/end figures and photos for one plan (GET /client/plans/{planId}/summary). */
export function fetchPlanSummary(
  planId: string,
  signal?: AbortSignal,
): Promise<GetClientPlanSummaryResponse> {
  return api.getClientPlanSummaryEndpoint(planId, signal);
}

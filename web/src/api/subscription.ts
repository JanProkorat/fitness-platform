import { apiClient } from '@/api/client';
import type { GetMySubscriptionResponse } from '@/api/generated';

/** GET /users/me/subscription — the coach's plan, status, client usage and feature flags. */
export async function getMySubscription(): Promise<GetMySubscriptionResponse> {
  return apiClient.getMySubscriptionEndpoint();
}

export const subscriptionKeys = {
  mine: ['subscription', 'me'] as const,
};

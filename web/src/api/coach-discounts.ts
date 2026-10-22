/**
 * Coach discounts API module.
 *
 * Wraps the NSwag-generated /payments/discounts endpoints.
 */
import { apiClient } from '@/api/client';
import { DiscountDuration, DiscountScope, DiscountType } from '@/api/generated';
import type {
  CoachDiscountDto,
  CreateCoachDiscountRequest,
  UpdateCoachDiscountRequest,
} from '@/api/generated';

export { DiscountDuration, DiscountScope, DiscountType };
export type { CoachDiscountDto, CreateCoachDiscountRequest, UpdateCoachDiscountRequest };

export const coachDiscountsKey = ['payments', 'discounts'] as const;

/** Lists the coach's discounts, archived ones included, via GET /payments/discounts. */
export async function getCoachDiscounts(): Promise<CoachDiscountDto[]> {
  const response = await apiClient.listCoachDiscountsEndpoint(true);
  return response.items ?? [];
}

/** Creates a discount via POST /payments/discounts. */
export async function createCoachDiscount(request: CreateCoachDiscountRequest): Promise<CoachDiscountDto> {
  return apiClient.createCoachDiscountEndpoint(request);
}

/** Replaces a discount via PUT /payments/discounts/{discountId}. */
export async function updateCoachDiscount(
  discountId: string,
  request: UpdateCoachDiscountRequest,
): Promise<CoachDiscountDto> {
  return apiClient.updateCoachDiscountEndpoint(discountId, request);
}

/** Archives a discount via POST /payments/discounts/{discountId}/archive. */
export async function archiveCoachDiscount(discountId: string): Promise<void> {
  await apiClient.archiveCoachDiscountEndpoint(discountId);
}

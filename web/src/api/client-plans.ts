import api from '@/lib/api';
import type {
  ListClientPlansResponse,
  ClientPlanItem,
  ClientPlanResultSummary,
} from '@/api/generated';

// Re-export generated types so consumers can import from this module unchanged.
export type { ListClientPlansResponse, ClientPlanItem, ClientPlanResultSummary };

/**
 * Plan type discriminator — kept as a local narrowing union because the
 * generated ClientPlanItem.planType field is typed as `string`. The values
 * ("Nutrition" | "Training") are stable backend constants, not an emitted enum.
 */
export type PlanType = 'Nutrition' | 'Training';

/**
 * Plan status discriminator — kept as a local narrowing union because the
 * generated ClientPlanItem.status field is typed as `string`. Used as a
 * Record key in PlanyTab's StatusChip component.
 */
export type PlanStatus = 'Draft' | 'Active' | 'Completed' | 'Archived';

/**
 * Fetch the combined plan list (nutrition + training) for a client.
 * Route: GET /trainer/clients/{clientId}/plans
 */
export async function getClientPlans(
  clientId: string,
): Promise<ListClientPlansResponse> {
  const { data } = await api.get<ListClientPlansResponse>(
    `/trainer/clients/${clientId}/plans`,
  );
  return data;
}

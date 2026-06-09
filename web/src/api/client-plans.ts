import api from '@/lib/api';

/**
 * Plan type discriminator — mirrors the backend PlanType string.
 */
export type PlanType = 'Nutrition' | 'Training';

/**
 * Plan status discriminator — mirrors the backend plan status strings.
 */
export type PlanStatus = 'Draft' | 'Active' | 'Completed' | 'Archived';

/**
 * Per-plan result summary. Fields not applicable to the plan type are null.
 * Mirrors backend ClientPlanResultSummary.
 *
 * Training-plan fields: totalTrainings, prCount.
 * Nutrition-plan fields: compliancePercent, weightDeltaKg.
 */
export interface ClientPlanResultSummary {
  /**
   * Count of completed WorkoutLogs for this plan.
   * Null for nutrition plans.
   */
  totalTrainings: number | null;
  /**
   * Count of PersonalRecords achieved within the plan's date window.
   * Null for nutrition plans or plans without a StartDate.
   */
  prCount: number | null;
  /**
   * Nutrition compliance percent (0–100) over the plan period.
   * Null for training plans or plans without a StartDate.
   */
  compliancePercent: number | null;
  /**
   * Weight delta (kg) from first to last measurement in the plan window.
   * Positive = weight gained; negative = weight lost.
   * Null for training plans or when fewer than two measurements exist.
   */
  weightDeltaKg: number | null;
}

/**
 * A single plan entry in the combined client plan list.
 * Mirrors backend ClientPlanItem.
 */
export interface ClientPlanItem {
  /** The plan's public ExternalId (Guid). */
  planId: string;
  /** Discriminates the plan type: "Nutrition" or "Training". */
  planType: PlanType;
  /** Display name of the plan. */
  name: string;
  /** ISO 8601 UTC — the Monday when Week 1 begins. Null when not yet set. */
  periodStart: string | null;
  /**
   * ISO 8601 UTC — when the plan was marked completed.
   * Null for active/draft plans and open-ended plans.
   */
  periodEnd: string | null;
  /** Current plan status: "Draft" | "Active" | "Completed" | "Archived". */
  status: PlanStatus;
  /** Per-plan result metrics. */
  resultSummary: ClientPlanResultSummary;
}

/**
 * Response from GET /trainer/clients/{clientId}/plans.
 * Mirrors backend ListClientPlansResponse.
 *
 * NOTE: generated.ts does not yet contain this type — regen-api will be run
 * once at the epic-PR stage to reconcile hand-written modules. This is the
 * hand-authored source of truth for the web client until then.
 */
export interface ListClientPlansResponse {
  /** All plans (nutrition + training), newest first. */
  plans: ClientPlanItem[];
}

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

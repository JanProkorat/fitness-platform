/**
 * Hand-maintained supplement types for issue #332.
 *
 * These mirror `web/src/api/plan-types.ts`. The backend supplement fields
 * are NOT yet in the NSwag-generated `generated.ts` (regen-api is skipped
 * because the dev backend is unavailable in this session). CI will regenerate
 * and these types will be superseded once regen runs. Until then, consumers
 * import `SupplementDto` from here rather than from `generated.ts`.
 */

/**
 * A supplement entry returned by the API in GetFullPlanResponse.supplements.
 * Mapped from backend SupplementDto in GetFullPlanEndpoint.
 */
export interface SupplementDto {
  externalId: string;
  name: string;
  dose?: string | null;
  notes?: string | null;
}

/**
 * Extends the generated GetFullPlanResponse with the supplements field
 * that the backend now returns but is not yet reflected in generated.ts.
 */
export interface FullPlanResponseWithSupplements {
  supplements?: SupplementDto[];
}

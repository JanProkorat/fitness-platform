/**
 * Coach packages API module.
 *
 * Wraps the NSwag-generated /payments/packages endpoints.
 */
import { apiClient } from '@/api/client';
import { PackageBillingInterval, PaymentCurrency } from '@/api/generated';
import type {
  CoachPackageDto,
  CreateCoachPackageRequest,
  UpdateCoachPackageRequest,
} from '@/api/generated';

export { PackageBillingInterval, PaymentCurrency };
export type { CoachPackageDto, CreateCoachPackageRequest, UpdateCoachPackageRequest };

export const coachPackagesKey = ['payments', 'packages'] as const;

/** Lists the coach's packages, archived ones included, via GET /payments/packages. */
export async function getCoachPackages(): Promise<CoachPackageDto[]> {
  const response = await apiClient.listCoachPackagesEndpoint(true);
  return response.items ?? [];
}

/** Creates a package via POST /payments/packages. */
export async function createCoachPackage(request: CreateCoachPackageRequest): Promise<CoachPackageDto> {
  return apiClient.createCoachPackageEndpoint(request);
}

/** Replaces a package via PUT /payments/packages/{packageId}. */
export async function updateCoachPackage(
  packageId: string,
  request: UpdateCoachPackageRequest,
): Promise<CoachPackageDto> {
  return apiClient.updateCoachPackageEndpoint(packageId, request);
}

/** Archives a package via POST /payments/packages/{packageId}/archive. */
export async function archiveCoachPackage(packageId: string): Promise<void> {
  await apiClient.archiveCoachPackageEndpoint(packageId);
}

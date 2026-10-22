/**
 * Client payments API module.
 *
 * Wraps the NSwag-generated per-client payment endpoints of the coach's Payment tab, plus the
 * package and discount lists the terms picker reads.
 */
import { apiClient } from '@/api/client';
import {
  ClientPaymentKind,
  ClientPaymentStatus,
  DiscountScope,
  DiscountType,
  PackageBillingInterval,
  PaymentCurrency,
} from '@/api/generated';
import type {
  AddClientOneOffPaymentRequest,
  ClientPaymentHistoryEntryDto,
  ClientPaymentRowDto,
  ClientPaymentSummaryTermsDto,
  CoachDiscountDto,
  CoachPackageDto,
  GetClientPaymentSummaryResponse,
  MarkClientPaymentPaidRequest,
  RequestClientPaymentRequest,
  RequestClientPaymentResponse,
  SetClientPaymentTermsRequest,
  SetClientPaymentTermsResponse,
  WaiveClientPaymentRequest,
} from '@/api/generated';

export {
  ClientPaymentKind,
  ClientPaymentStatus,
  DiscountScope,
  DiscountType,
  PackageBillingInterval,
  PaymentCurrency,
};
export type {
  AddClientOneOffPaymentRequest,
  ClientPaymentHistoryEntryDto,
  ClientPaymentRowDto,
  ClientPaymentSummaryTermsDto,
  CoachDiscountDto,
  CoachPackageDto,
  GetClientPaymentSummaryResponse,
  MarkClientPaymentPaidRequest,
  RequestClientPaymentRequest,
  RequestClientPaymentResponse,
  SetClientPaymentTermsRequest,
  SetClientPaymentTermsResponse,
  WaiveClientPaymentRequest,
};

/** GET /payments/clients/{clientId}/summary — package, price, next payment and progress. */
export function getClientPaymentSummary(clientId: string): Promise<GetClientPaymentSummaryResponse> {
  return apiClient.getClientPaymentSummaryEndpoint(clientId);
}

/** GET the client's payment rows, newest due date first. */
export async function listClientPaymentRows(clientId: string): Promise<ClientPaymentRowDto[]> {
  const result = await apiClient.listClientPaymentRowsEndpoint(clientId);
  return result.payments ?? [];
}

/** GET the coach's change history for this client, newest first. */
export async function getClientPaymentHistory(clientId: string): Promise<ClientPaymentHistoryEntryDto[]> {
  const result = await apiClient.getClientPaymentHistoryEndpoint(clientId);
  return result.entries ?? [];
}

export function setClientPaymentTerms(
  clientId: string,
  request: SetClientPaymentTermsRequest,
): Promise<SetClientPaymentTermsResponse> {
  return apiClient.setClientPaymentTermsEndpoint(clientId, request);
}

export function markClientPaymentPaid(
  clientId: string,
  paymentId: string,
  request: MarkClientPaymentPaidRequest,
): Promise<ClientPaymentRowDto> {
  return apiClient.markClientPaymentPaidEndpoint(clientId, paymentId, request);
}

export function waiveClientPayment(
  clientId: string,
  paymentId: string,
  request: WaiveClientPaymentRequest,
): Promise<ClientPaymentRowDto> {
  return apiClient.waiveClientPaymentEndpoint(clientId, paymentId, request);
}

export function requestClientPayment(
  clientId: string,
  paymentId: string,
  request: RequestClientPaymentRequest,
): Promise<RequestClientPaymentResponse> {
  return apiClient.requestClientPaymentEndpoint(clientId, paymentId, request);
}

export function addClientOneOffPayment(
  clientId: string,
  request: AddClientOneOffPaymentRequest,
): Promise<ClientPaymentRowDto> {
  return apiClient.addClientOneOffPaymentEndpoint(clientId, request);
}

/** The coach's active packages, for the terms picker. */
export async function listActivePackages(): Promise<CoachPackageDto[]> {
  const result = await apiClient.listCoachPackagesEndpoint(false);
  return result.items ?? [];
}

/** The coach's active discounts, for the terms picker. */
export async function listActiveDiscounts(): Promise<CoachDiscountDto[]> {
  const result = await apiClient.listCoachDiscountsEndpoint(false);
  return result.items ?? [];
}

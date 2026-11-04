import api from '@/lib/api';
import { ClientRequestStatus } from '@/api/generated';
import type {
  GetIncomingRequestsResponse,
  IncomingClientRequestDto,
  IncomingRequestPackageDto,
  ProposeClientRequestPackageRequest,
} from '@/api/generated';

export { ClientRequestStatus };
export type { IncomingClientRequestDto, IncomingRequestPackageDto, ProposeClientRequestPackageRequest };

export async function getIncomingRequests(): Promise<IncomingClientRequestDto[]> {
  const { data } = await api.get<GetIncomingRequestsResponse>('/trainer/client-requests');
  return data.requests ?? [];
}

export interface AcceptClientRequestBody {
  questionnairePublicId?: string | null;
  statement?: string;
  /** A discount applied to the package the client attached; ignored by the server when there is none. */
  discountPublicId?: string | null;
  /** "None": send no form at all instead of the coach's default. Never together with a questionnaire. */
  skipOnboardingForm?: boolean;
}

export async function acceptClientRequest(publicId: string, body: AcceptClientRequestBody = {}): Promise<void> {
  await api.post(`/trainer/client-requests/${publicId}/accept`, {
    questionnairePublicId: body.questionnairePublicId || null,
    statement: body.statement || null,
    discountPublicId: body.discountPublicId || null,
    ...(body.skipOnboardingForm ? { skipOnboardingForm: true } : {}),
  });
}

export async function rejectClientRequest(publicId: string, statement?: string): Promise<void> {
  await api.post(`/trainer/client-requests/${publicId}/reject`, {
    statement: statement ?? null,
  });
}

/** Proposes one of the coach's packages on a request that has none; the request moves to PackageProposed. */
export async function proposeClientRequestPackage(
  publicId: string,
  body: ProposeClientRequestPackageRequest,
): Promise<void> {
  await api.post(`/trainer/client-requests/${publicId}/propose-package`, {
    packagePublicId: body.packagePublicId,
    discountPublicId: body.discountPublicId || null,
    questionnairePublicId: body.questionnairePublicId || null,
    statement: body.statement || null,
    ...(body.skipOnboardingForm ? { skipOnboardingForm: true } : {}),
  });
}

/** Takes back a waiting proposal; the request is Pending again. */
export async function withdrawClientRequestProposal(publicId: string): Promise<void> {
  await api.post(`/trainer/client-requests/${publicId}/withdraw-proposal`, {});
}

import { api } from '@/api/client';
import { ApiException, ClientRequestStatus } from '@/api/generated';
import type { ClientRequestDto, ClientRequestProposalDto } from '@/api/generated';
import { getErrorStatus, getProblemCode, isNetworkError } from '@/api/errors';
import { errorCodes } from '@/lib/outbox/classify';

export const REQUEST_MESSAGE_MAX_LENGTH = 500;

const PROFESSIONAL_NOT_ACCEPTING = 'PROFESSIONAL_NOT_ACCEPTING';
const REQUEST_ALREADY_PENDING = 'REQUEST_ALREADY_PENDING';
const ALREADY_LINKED = 'ALREADY_LINKED';
const PROFESSIONAL_NOT_FOUND = 'PROFESSIONAL_NOT_FOUND';
const REQUEST_PACKAGE_UNAVAILABLE = 'REQUEST_PACKAGE_UNAVAILABLE';
const CLIENT_REQUEST_NOT_FOUND = 'CLIENT_REQUEST_NOT_FOUND';
const CLIENT_REQUEST_INVALID_STATE = 'CLIENT_REQUEST_INVALID_STATE';
const PROFESSION_ALREADY_OCCUPIED = 'PROFESSION_ALREADY_OCCUPIED';
const COACH_ROLE_REMOVED = 'COACH_ROLE_REMOVED';

export type SendRequestInput = {
  professionalPublicId: string;
  message: string;
  shareHistory: boolean;
  /** Public id of one of the coach's packages; left out when the client picked none. */
  packagePublicId?: string;
};

export type SendRequestFailure =
  | 'notAccepting'
  | 'alreadyPending'
  | 'alreadyLinked'
  | 'notFound'
  | 'packageUnavailable'
  | 'network'
  | 'generic';

/** POST /client/requests; resolves on 201. */
export async function sendClientRequest(input: SendRequestInput): Promise<void> {
  const message = input.message.trim();
  await api.sendClientRequestEndpoint({
    professionalPublicId: input.professionalPublicId,
    message: message.length > 0 ? message : undefined,
    shareHistory: input.shareHistory,
    packagePublicId: input.packagePublicId,
  });
}

/** The problem code of an error; the generated client delivers a 400 body as raw text on an ApiException. */
function readCode(error: unknown): string | undefined {
  const direct = getProblemCode(error);
  if (direct) return direct;
  if (!(error instanceof ApiException)) return undefined;
  try {
    return getProblemCode(JSON.parse(error.response) as unknown);
  } catch {
    return undefined;
  }
}

/** Maps anything `sendClientRequest` can throw to the failure the sheet shows. */
export function classifySendRequestError(error: unknown): SendRequestFailure {
  if (isNetworkError(error)) return 'network';
  switch (readCode(error)) {
    case PROFESSIONAL_NOT_ACCEPTING:
      return 'notAccepting';
    case REQUEST_ALREADY_PENDING:
      return 'alreadyPending';
    case ALREADY_LINKED:
      return 'alreadyLinked';
    case PROFESSIONAL_NOT_FOUND:
      return 'notFound';
    case REQUEST_PACKAGE_UNAVAILABLE:
      return 'packageUnavailable';
  }
  return getErrorStatus(error) === 404 ? 'notFound' : 'generic';
}

export const MY_REQUESTS_KEY = ['clientRequests', 'mine'] as const;

export type ClientRequest = ClientRequestDto;
export type RequestProposal = ClientRequestProposalDto;

/** The requests the client has sent (GET /client/requests). */
export async function fetchMyRequests(signal?: AbortSignal): Promise<ClientRequest[]> {
  const response = await api.getMyRequestsEndpoint(signal);
  return response.requests ?? [];
}

/** Still waiting for the professional's reply. */
export const isPendingRequest = (request: ClientRequest): boolean => request.status === ClientRequestStatus.Pending;

/** The coach proposed a package and waits for the client's answer. */
export const hasOpenProposal = (request: ClientRequest | undefined): boolean =>
  request?.status === ClientRequestStatus.PackageProposed && request.proposal !== undefined;

/** Withdraws a pending request (DELETE /client/requests/{publicId}). */
export function cancelClientRequest(publicId: string): Promise<void> {
  return api.cancelClientRequestEndpoint(publicId);
}

/** Accepts the coach's package proposal (POST accept-proposal); resolves on 204. */
export function acceptRequestProposal(publicId: string): Promise<void> {
  return api.acceptClientRequestProposalEndpoint(publicId);
}

/** Declines the coach's package proposal (POST decline-proposal); resolves on 204. */
export function declineRequestProposal(publicId: string): Promise<void> {
  return api.declineClientRequestProposalEndpoint(publicId);
}

export type ProposalFailure =
  | 'notFound'
  | 'invalidState'
  | 'professionOccupied'
  | 'coachRoleRemoved'
  | 'network'
  | 'generic';

/** Maps anything accepting or declining a proposal can throw to the failure the screen shows. */
export function classifyProposalError(error: unknown): ProposalFailure {
  if (isNetworkError(error)) return 'network';
  const codes = errorCodes(error);
  if (codes.includes(CLIENT_REQUEST_NOT_FOUND)) return 'notFound';
  if (codes.includes(CLIENT_REQUEST_INVALID_STATE)) return 'invalidState';
  if (codes.includes(PROFESSION_ALREADY_OCCUPIED)) return 'professionOccupied';
  if (codes.includes(COACH_ROLE_REMOVED)) return 'coachRoleRemoved';
  const status = getErrorStatus(error);
  if (status === 404) return 'notFound';
  if (status === 409) return 'invalidState';
  return 'generic';
}

import { api } from '@/api/client';
import { ApiException, ClientRequestStatus } from '@/api/generated';
import type { ClientRequestDto } from '@/api/generated';
import { getErrorStatus, getProblemCode, isNetworkError } from '@/api/errors';

export const REQUEST_MESSAGE_MAX_LENGTH = 500;

const PROFESSIONAL_NOT_ACCEPTING = 'PROFESSIONAL_NOT_ACCEPTING';
const REQUEST_ALREADY_PENDING = 'REQUEST_ALREADY_PENDING';
const ALREADY_LINKED = 'ALREADY_LINKED';
const PROFESSIONAL_NOT_FOUND = 'PROFESSIONAL_NOT_FOUND';

export type SendRequestInput = {
  professionalPublicId: string;
  message: string;
  shareHistory: boolean;
};

export type SendRequestFailure =
  | 'notAccepting'
  | 'alreadyPending'
  | 'alreadyLinked'
  | 'notFound'
  | 'network'
  | 'generic';

/** POST /client/requests; resolves on 201. */
export async function sendClientRequest(input: SendRequestInput): Promise<void> {
  const message = input.message.trim();
  await api.sendClientRequestEndpoint({
    professionalPublicId: input.professionalPublicId,
    message: message.length > 0 ? message : undefined,
    shareHistory: input.shareHistory,
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
  }
  return getErrorStatus(error) === 404 ? 'notFound' : 'generic';
}

export const MY_REQUESTS_KEY = ['clientRequests', 'mine'] as const;

export type ClientRequest = ClientRequestDto;

/** The requests the client has sent (GET /client/requests). */
export async function fetchMyRequests(signal?: AbortSignal): Promise<ClientRequest[]> {
  const response = await api.getMyRequestsEndpoint(signal);
  return response.requests ?? [];
}

/** Still waiting for the professional's reply. */
export const isPendingRequest = (request: ClientRequest): boolean => request.status === ClientRequestStatus.Pending;

/** Withdraws a pending request (DELETE /client/requests/{publicId}). */
export function cancelClientRequest(publicId: string): Promise<void> {
  return api.cancelClientRequestEndpoint(publicId);
}

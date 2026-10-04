/**
 * Client-tags API module.
 *
 * Wraps the NSwag-generated ClientTags slice endpoints.
 */
import { apiClient } from '@/api/client';
import type {
  ClientTagDto,
  CreateClientTagRequest,
  UpdateClientTagRequest,
  ReplaceClientTagAssignmentsResponse,
} from '@/api/generated';

export type {
  ClientTagDto,
  CreateClientTagRequest,
  UpdateClientTagRequest,
  ReplaceClientTagAssignmentsResponse,
};

/**
 * Lists the caller's tags via GET /trainer/client-tags.
 */
export async function getClientTags(): Promise<ClientTagDto[]> {
  const response = await apiClient.getClientTagsEndpoint();
  return response.tags ?? [];
}

/**
 * Creates a tag owned by the caller via POST /trainer/client-tags.
 *
 * Can fail with CLIENT_TAG_NAME_ALREADY_EXISTS (409) — the caller renders
 * that inline on the name field and does not optimistically insert.
 */
export async function createClientTag(request: CreateClientTagRequest): Promise<ClientTagDto> {
  return apiClient.createClientTagEndpoint(request);
}

/**
 * Updates a tag's name/description/color via PUT /trainer/client-tags/{tagId}.
 */
export async function updateClientTag(
  tagId: string,
  request: UpdateClientTagRequest,
): Promise<ClientTagDto> {
  return apiClient.updateClientTagEndpoint(tagId, request);
}

/**
 * Deletes a tag via DELETE /trainer/client-tags/{tagId}.
 */
export async function deleteClientTag(tagId: string): Promise<void> {
  await apiClient.deleteClientTagEndpoint(tagId);
}

/**
 * Replaces the full set of tags assigned to a client, for the caller's own
 * link, via PUT /trainer/clients/{clientId}/tags.
 */
export async function replaceClientTagAssignments(
  clientId: string,
  tagIds: string[],
): Promise<ReplaceClientTagAssignmentsResponse> {
  return apiClient.replaceClientTagAssignmentsEndpoint(clientId, { tagIds });
}

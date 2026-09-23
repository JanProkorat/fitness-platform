/**
 * Inbox/conversations API module (#1095).
 *
 * Wraps the NSwag-generated conversation endpoints. Thin pass-throughs —
 * the generated client already builds correct query strings/request
 * bodies, so there's nothing to reshape here (contrast `api/clients.ts`,
 * which normalises optional-array fields on the response).
 */
import { apiClient } from '@/api/client';
import type {
  ClientListFilter,
  ConversationDto,
  GetConversationFilterCountsResponse,
  GetMessagesResponse,
  ParticipantDto,
  SendMessageResponse,
} from '@/api/generated';

export type {
  ClientListFilter,
  ConversationDto,
  GetConversationFilterCountsResponse,
  GetMessagesResponse,
  ParticipantDto,
  SendMessageResponse,
};

/** GET /conversations — the caller's conversation list, newest activity first. */
export async function getConversations(archived: boolean, filter?: ClientListFilter): Promise<ConversationDto[]> {
  return apiClient.getConversationsEndpoint(archived, filter);
}

/** GET /conversations/filter-counts — per-chip counts for the filter dropdown. Trainer/Nutritionist only. */
export async function getConversationFilterCounts(): Promise<GetConversationFilterCountsResponse> {
  return apiClient.getConversationFilterCountsEndpoint();
}

/**
 * POST /conversations — gets or creates a conversation with the given
 * participant (a `ClientProfile.PublicId`). 404s with `NOT_LINKED_TO_CLIENT`
 * when no conversation exists yet and the caller holds no live link.
 */
export async function startConversation(participantId: string): Promise<ConversationDto> {
  return apiClient.startConversationEndpoint({ participantId });
}

export interface GetMessagesParams {
  /** Last message's id from the previous page — omit for the newest page. */
  cursor?: string;
  limit?: number;
}

/** GET /conversations/{id}/messages — newest-first, cursor-paginated. */
export async function getMessages(conversationId: string, params: GetMessagesParams = {}): Promise<GetMessagesResponse> {
  return apiClient.getMessagesEndpoint(conversationId, params.limit, params.cursor);
}

/** POST /conversations/{id}/messages — text only, ≤4000 chars (validated server-side). */
export async function sendMessage(conversationId: string, text: string): Promise<SendMessageResponse> {
  return apiClient.sendMessageEndpoint(conversationId, { text });
}

/** POST /conversations/{id}/read — marks every message from the other party read. */
export async function markConversationRead(conversationId: string): Promise<void> {
  await apiClient.markConversationReadEndpoint(conversationId);
}

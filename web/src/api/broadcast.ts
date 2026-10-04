/**
 * Broadcast-message API module.
 *
 * Wraps the NSwag-generated `broadcastMessageEndpoint`.
 */
import { apiClient } from '@/api/client';
import type { BroadcastMessageRequest, BroadcastMessageResponse } from '@/api/generated';

export type { BroadcastMessageRequest, BroadcastMessageResponse };

/**
 * Sends the same text message to several clients at once via
 * POST /conversations/broadcast.
 *
 * Error paths the caller must handle: 400 empty/over-length text,
 * BROADCAST_RECIPIENT_LIMIT_EXCEEDED (>50 recipients),
 * BROADCAST_MESSAGE_TOO_LONG_AFTER_SUBSTITUTION ({{fullName}} expansion
 * pushes a recipient over the limit), 404
 * BROADCAST_RECIPIENT_NOT_LINKED (a selected client's link died since load).
 */
export async function broadcastMessage(
  request: BroadcastMessageRequest,
): Promise<BroadcastMessageResponse> {
  return apiClient.broadcastMessageEndpoint(request);
}

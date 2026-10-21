import { api } from '@/api/client';
import type { ConversationDto, MessageDto, SendMessageResponse } from '@/api/generated';

export type Conversation = ConversationDto;
export type ChatMessage = MessageDto;

/** Query-key prefix for the conversation list; realtime events invalidate it. */
export const CONVERSATIONS_QUERY_KEY = ['conversations'] as const;
export const conversationMessagesQueryKey = (conversationId: string) =>
  ['conversation-messages', conversationId] as const;

/** Newest messages shown in a chat; older history is not paged in yet. */
export const MESSAGES_PAGE_SIZE = 50;

/** Longest message text the server accepts. */
export const MESSAGE_MAX_LENGTH = 4000;

/** The signed-in client's live conversations, newest activity first. */
export function fetchConversations(signal?: AbortSignal): Promise<Conversation[]> {
  return api.getConversationsEndpoint(false, undefined, signal);
}

/** Messages of one chat, newest first. */
export async function fetchMessages(conversationId: string, signal?: AbortSignal): Promise<ChatMessage[]> {
  const response = await api.getMessagesEndpoint(conversationId, MESSAGES_PAGE_SIZE, undefined, signal);
  return response.items ?? [];
}

export function sendMessage(conversationId: string, text: string): Promise<SendMessageResponse> {
  return api.sendMessageEndpoint(conversationId, { text });
}

export function markConversationRead(conversationId: string): Promise<void> {
  return api.markConversationReadEndpoint(conversationId);
}

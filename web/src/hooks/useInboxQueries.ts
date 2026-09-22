import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getConversationFilterCounts,
  getConversations,
  getMessages,
  markConversationRead,
  sendMessage,
  startConversation,
} from '@/api/conversations';
import { showApiError } from '@/lib/api-errors';
import type { ClientListFilter } from '@/api/generated';

const MESSAGES_PAGE_SIZE = 30;

/** The caller's conversation list for the active/archived view and filter chip. */
export function useConversations(archived: boolean, filter: ClientListFilter) {
  return useQuery({
    queryKey: ['conversations', 'list', archived, filter],
    queryFn: () => getConversations(archived, filter),
  });
}

/** Per-filter-chip counts for the dropdown's "(n)" labels. */
export function useConversationFilterCounts() {
  return useQuery({
    queryKey: ['conversations', 'filter-counts'],
    queryFn: getConversationFilterCounts,
  });
}

/**
 * Gets or creates a conversation with a participant (deep-link entry from
 * `/inbox?client=<publicId>`, and the row-open path for a null-id
 * placeholder row). 404s (NOT_LINKED_TO_CLIENT / unknown client) surface as
 * a toast rather than a silently empty thread — the caller decides what to
 * do next (e.g. stay on the empty state).
 */
export function useStartConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) => startConversation(participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
    },
    onError: (error) => {
      showApiError(error, 'inbox.deepLink.error');
    },
  });
}

/**
 * A conversation's messages, newest-first per page and cursor-paginated
 * backward in time (`GetMessagesEndpoint`'s contract — cursor is the last
 * fetched message's id, null once no older messages remain). Consumers
 * flatten `data.pages` (already time-descending across pages, since each
 * page continues exactly where the previous one's cursor left off) and
 * reverse once to render oldest-at-top/newest-at-bottom.
 */
export function useConversationMessages(conversationId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['conversations', conversationId, 'messages'],
    queryFn: ({ pageParam }) => getMessages(conversationId!, { cursor: pageParam, limit: MESSAGES_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    enabled: Boolean(conversationId),
  });
}

/** Sends a text message in the given conversation and refreshes the thread + the list preview. */
export function useSendMessage(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => sendMessage(conversationId!, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
    },
    onError: (error) => {
      showApiError(error, 'inbox.composer.sendError');
    },
  });
}

/** Marks a conversation read on open and refreshes the list's unread dot + the filter counts. */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['conversations', 'filter-counts'] });
    },
  });
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import ConversationList from '@/components/inbox/ConversationList';
import ThreadPane from '@/components/inbox/ThreadPane';
import ThreadEmptyState from '@/components/inbox/ThreadEmptyState';
import ClientSidePanel from '@/components/inbox/ClientSidePanel';
import { useConversationFilterCounts, useConversations, useStartConversation } from '@/hooks/useInboxQueries';
import { useSignalR } from '@/hooks/useSignalR';
import { useAuthStore } from '@/stores/auth';
import { ClientListFilter } from '@/api/generated';

const TYPING_INDICATOR_TIMEOUT_MS = 3500;

interface NewMessagePayload {
  conversationId: string;
}

interface TypingPayload {
  conversationId: string;
  senderId: string;
}

/**
 * The inbox page (#1095): a three-pane layout (conversation list, thread,
 * optional client panel) that escapes AppShell's page padding via a
 * negative margin so the panes butt up against the viewport edges, per
 * docs/design/1095/inbox-inventory.md. AppShell/Sidebar are #1073's and
 * out of scope — see the design inventory's provenance note on why the
 * pixel sizes here are estimates, repo tokens win.
 */
export default function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.publicId);

  const [archived, setArchived] = useState(false);
  const [filter, setFilter] = useState<ClientListFilter>(ClientListFilter.All);
  const [search, setSearch] = useState('');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | undefined>(undefined);
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [isOtherPartyTyping, setIsOtherPartyTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const deepLinkHandledRef = useRef(false);

  const conversationsQuery = useConversations(archived, filter);
  const countsQuery = useConversationFilterCounts();
  const startConversationMutation = useStartConversation();

  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);
  const selectedConversation = conversations.find((c) => c.participant?.id === selectedParticipantId);

  // Reset the typing indicator whenever the open thread changes.
  useEffect(() => {
    setIsOtherPartyTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [selectedConversation?.id]);

  // `?client=<publicId>` deep-link entry from the client-detail page's Chat
  // button: select the matching row if a conversation already exists,
  // otherwise start one. An unknown/unlinked id surfaces as a toast via
  // useStartConversation's onError — never a silently empty thread.
  useEffect(() => {
    const clientParam = searchParams.get('client');
    if (!clientParam || deepLinkHandledRef.current || conversationsQuery.isPending) {
      return;
    }
    deepLinkHandledRef.current = true;

    const existingRow = conversations.find((c) => c.participant?.clientPublicId === clientParam);
    if (existingRow?.id) {
      setSelectedParticipantId(existingRow.participant?.id);
    } else {
      startConversationMutation.mutate(clientParam, {
        onSuccess: (conversation) => setSelectedParticipantId(conversation.participant?.id),
      });
    }

    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('client');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once conversations resolve; deepLinkHandledRef guards re-entry
  }, [conversationsQuery.isPending]);

  function handleSelectConversation(conversation: (typeof conversations)[number]) {
    if (conversation.id) {
      setSelectedParticipantId(conversation.participant?.id);
      return;
    }
    // Null-id placeholder row (a linked client with no conversation yet) — start it.
    const clientPublicId = conversation.participant?.clientPublicId;
    if (!clientPublicId) {
      return;
    }
    startConversationMutation.mutate(clientPublicId, {
      onSuccess: (started) => setSelectedParticipantId(started.participant?.id),
    });
  }

  const signalRHandlers = useMemo(
    () => ({
      newmessage: (payload: unknown) => {
        const { conversationId } = payload as NewMessagePayload;
        queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'messages'] });
        queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['conversations', 'filter-counts'] });
      },
      typing: (payload: unknown) => {
        const { conversationId, senderId } = payload as TypingPayload;
        if (conversationId !== selectedConversation?.id || senderId === currentUserId) {
          return;
        }
        setIsOtherPartyTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => setIsOtherPartyTyping(false), TYPING_INDICATOR_TIMEOUT_MS);
      },
      userPresence: () => {
        queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
      },
      conversationunarchived: () => {
        queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
      },
    }),
    [queryClient, selectedConversation?.id, currentUserId],
  );
  useSignalR(signalRHandlers);

  return (
    <div className="-m-6 flex h-screen overflow-hidden">
      <ConversationList
        archived={archived}
        onArchivedChange={setArchived}
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        counts={countsQuery.data}
        conversations={conversations}
        isPending={conversationsQuery.isPending}
        isError={conversationsQuery.isError}
        onRetry={() => void conversationsQuery.refetch()}
        selectedParticipantId={selectedParticipantId}
        onSelectConversation={handleSelectConversation}
      />

      {selectedConversation?.id && selectedConversation.participant ? (
        <ThreadPane
          conversationId={selectedConversation.id}
          participant={selectedConversation.participant}
          showClientPanel={showClientPanel}
          onToggleClientPanel={() => setShowClientPanel((previous) => !previous)}
          isOtherPartyTyping={isOtherPartyTyping}
        />
      ) : (
        <ThreadEmptyState />
      )}

      {showClientPanel && selectedConversation?.participant?.clientPublicId && (
        <ClientSidePanel clientPublicId={selectedConversation.participant.clientPublicId} />
      )}
    </div>
  );
}

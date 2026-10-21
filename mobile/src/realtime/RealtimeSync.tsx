import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { CONVERSATIONS_QUERY_KEY } from '@/api/conversations';
import { INVITES_QUERY_KEY } from '@/api/invites';
import { NOTIFICATIONS_QUERY_KEY } from '@/api/notifications';
import { PROFILE_QUERY_KEY } from '@/api/profile';

import { useRealtimeEvent, useRealtimeReconnected } from './useRealtimeEvent';

/** There is no "notification created" event, so every event that can create one refreshes the lists. */
const REFRESH_EVENTS = [
  'invitationreceived',
  'invitationcancelled',
  'newmessage',
  'conversationunarchived',
  'clientrequestaccepted',
  'clientrequestrejected',
  'clientrequestcancelled',
] as const;

/** A coach accepting the client's request links a coach, which changes Today. */
const PROFILE_EVENTS: readonly string[] = ['clientrequestaccepted'];

function EventRefresh({ event }: { event: string }) {
  const queryClient = useQueryClient();
  useRealtimeEvent(event, () => {
    void queryClient.invalidateQueries({ queryKey: INVITES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    if (PROFILE_EVENTS.includes(event)) {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    }
  });
  return null;
}

/** Keeps invites, notifications and conversations fresh from the hub; renders nothing. */
export function RealtimeSync() {
  const queryClient = useQueryClient();

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: INVITES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
  }, [queryClient]);
  useRealtimeReconnected(refreshAll);

  return (
    <>
      {REFRESH_EVENTS.map((event) => (
        <EventRefresh key={event} event={event} />
      ))}
    </>
  );
}

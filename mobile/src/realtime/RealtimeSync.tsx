import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { CONVERSATIONS_QUERY_KEY } from '@/api/conversations';
import { INVITES_QUERY_KEY } from '@/api/invites';
import { NOTIFICATIONS_QUERY_KEY } from '@/api/notifications';
import { PAYMENTS_QUERY_KEY } from '@/api/payments';
import { PLANS_QUERY_KEY } from '@/api/plans';
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
  'newnotification',
] as const;

/** A coach accepting the client's request links a coach, which changes Today. */
const PROFILE_EVENTS: readonly string[] = ['clientrequestaccepted'];

/** A coach asking for a payment arrives as a new notification, and changes what is owed. */
const PAYMENT_EVENTS: readonly string[] = ['newnotification'];

/** Query key prefix of everything on the Nutrition tab. */
const NUTRITION_QUERY_KEY = ['nutrition'] as const;

/** Nutrition plan events; published and completed also create a notification. */
const NUTRITION_EVENTS = [
  { event: 'nutritionplanpublished', notifies: true },
  { event: 'nutritionplanupdated', notifies: false },
  { event: 'nutritionplancompleted', notifies: true },
] as const;

function NutritionRefresh({ event, notifies }: { event: string; notifies: boolean }) {
  const queryClient = useQueryClient();
  useRealtimeEvent(event, () => {
    void queryClient.invalidateQueries({ queryKey: NUTRITION_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
    if (notifies) void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  });
  return null;
}

function EventRefresh({ event }: { event: string }) {
  const queryClient = useQueryClient();
  useRealtimeEvent(event, () => {
    void queryClient.invalidateQueries({ queryKey: INVITES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    if (PROFILE_EVENTS.includes(event)) {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    }
    if (PAYMENT_EVENTS.includes(event)) {
      void queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
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
    void queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: NUTRITION_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
  }, [queryClient]);
  useRealtimeReconnected(refreshAll);

  return (
    <>
      {REFRESH_EVENTS.map((event) => (
        <EventRefresh key={event} event={event} />
      ))}
      {NUTRITION_EVENTS.map(({ event, notifies }) => (
        <NutritionRefresh key={event} event={event} notifies={notifies} />
      ))}
    </>
  );
}

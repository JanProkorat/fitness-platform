import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { HubConnectionBuilder, HubConnection, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { RealtimeContext, setHubConnection, useSignalR, type RealtimeApi } from '@/hooks/useSignalR';

type Handler = (payload: unknown) => void;

/** Cooperation events that change what a coach sees in Pending, the notification popover or the Inbox badge. */
const COOPERATION_EVENTS = [
  'clientrequestreceived',
  'clientrequestcancelled',
  'inviteaccepted',
  'invitedeclined',
] as const;

/**
 * Owns the single SignalR connection of the signed-in portal session and lets
 * any component subscribe to its events through `useSignalR`. Connects when the
 * user is authenticated and disconnects on logout.
 */
export default function RealtimeProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const connectionRef = useRef<HubConnection | null>(null);
  const attachedRef = useRef<Set<string>>(new Set());
  const listenersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const reconnectedRef = useRef<Set<() => void>>(new Set());

  const attach = useCallback((connection: HubConnection, key: string) => {
    if (attachedRef.current.has(key)) return;
    attachedRef.current.add(key);
    // The SignalR JS client lowercases method names, so keys are lowercase.
    connection.on(key, (payload: unknown) => {
      listenersRef.current.get(key)?.forEach((handler) => handler(payload));
    });
  }, []);

  const api = useMemo<RealtimeApi>(
    () => ({
      subscribe: (event, handler) => {
        const key = event.toLowerCase();
        let handlers = listenersRef.current.get(key);
        if (!handlers) {
          handlers = new Set();
          listenersRef.current.set(key, handlers);
        }
        handlers.add(handler);
        if (connectionRef.current) attach(connectionRef.current, key);
        return () => {
          listenersRef.current.get(key)?.delete(handler);
        };
      },
      subscribeReconnected: (callback) => {
        reconnectedRef.current.add(callback);
        return () => {
          reconnectedRef.current.delete(callback);
        };
      },
    }),
    [attach],
  );

  // Connect/disconnect based on auth state only (not token changes).
  // StrictMode runs effects twice (mount -> cleanup -> mount), so cancellation
  // is tracked to avoid "stopped during negotiation" errors.
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/notifications', {
        accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    connectionRef.current = connection;
    attachedRef.current = new Set();
    for (const key of listenersRef.current.keys()) attach(connection, key);

    connection.onreconnected(() => {
      console.log('[SignalR] Reconnected');
      reconnectedRef.current.forEach((callback) => callback());
    });

    // If cleanup runs mid-negotiation, let start() finish and then stop —
    // calling stop() during negotiation logs an internal SignalR error.
    connection
      .start()
      .then(() => {
        if (cancelled) {
          connection.stop();
          return;
        }
        setHubConnection(connection);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[SignalR] Connection failed:', err);
        }
      });

    return () => {
      cancelled = true;
      if (connectionRef.current === connection) connectionRef.current = null;
      setHubConnection(null);
      if (connection.state === HubConnectionState.Connected) {
        connection.stop();
      }
    };
  }, [isAuthenticated, attach]);

  return (
    <RealtimeContext.Provider value={api}>
      <CoachRealtimeSync />
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Refetches the coach-facing lists on realtime events (and after a reconnect).
 * A new message only touches the inbox lists and notifications (the open thread
 * is refreshed by `InboxPage`); cooperation events also refresh clients and Pending.
 */
function CoachRealtimeSync() {
  const queryClient = useQueryClient();

  const invalidateInbox = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['conversations', 'filter-counts'] });
    void queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
  }, [queryClient]);

  const invalidateAll = useCallback(() => {
    invalidateInbox();
    void queryClient.invalidateQueries({ queryKey: ['clients', 'pending'] });
    // Carries the Pending tab's badge count.
    void queryClient.invalidateQueries({ queryKey: ['clients', 'list'] });
  }, [queryClient, invalidateInbox]);

  const handlers = useMemo(
    () => ({
      ...Object.fromEntries(COOPERATION_EVENTS.map((event) => [event, invalidateAll])),
      newmessage: invalidateInbox,
    }),
    [invalidateAll, invalidateInbox],
  );
  useSignalR(handlers, invalidateAll);

  return null;
}

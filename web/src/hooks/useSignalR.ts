import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';

type Handler = (payload: unknown) => void;

/** What the app-wide connection (see RealtimeProvider) offers to components. */
export interface RealtimeApi {
  /** Registers a handler for a hub event (any casing). Returns the unsubscribe function. */
  subscribe: (event: string, handler: Handler) => () => void;
  /** Registers a callback fired after the client silently re-establishes its connection. */
  subscribeReconnected: (callback: () => void) => () => void;
}

export const RealtimeContext = createContext<RealtimeApi | null>(null);

let _connection: HubConnection | null = null;

/** Called by RealtimeProvider as the single connection comes up and goes away. */
export function setHubConnection(connection: HubConnection | null): void {
  _connection = connection;
}

/** Invoke a hub method on the current SignalR connection (fire-and-forget). */
export function invokeHub(method: string, ...args: unknown[]): void {
  if (_connection?.state === HubConnectionState.Connected) {
    _connection.invoke(method, ...args).catch(() => {});
  }
}

/**
 * Subscribes to events on the one app-wide SignalR connection owned by
 * `RealtimeProvider`; it never opens a connection of its own, and a handler
 * added after the connection started still attaches.
 *
 * @param handlers - Map of event names to callbacks. Latest values are always
 *   used, so unstable references are fine.
 * @param onReconnected - Called after the SignalR client silently re-establishes
 *   its connection (transport downgrade, hub timeout, brief server restart —
 *   the browser's `navigator.onLine`/TanStack `refetchOnReconnect` never fires
 *   for these because the network itself never went down). Use this to
 *   invalidate queries that may have missed a broadcast during the gap;
 *   `useSignalR` never fetches data itself, only notifies.
 */
export function useSignalR(handlers: Record<string, Handler>, onReconnected?: () => void) {
  const realtime = useContext(RealtimeContext);
  const handlersRef = useRef(handlers);
  const onReconnectedRef = useRef(onReconnected);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
    onReconnectedRef.current = onReconnected;
  });

  const eventsKey = Object.keys(handlers).join('|');

  useEffect(() => {
    if (!realtime || eventsKey === '') return;
    const unsubscribes = eventsKey.split('|').map((event) =>
      realtime.subscribe(event, (payload) => handlersRef.current[event]?.(payload)),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [realtime, eventsKey]);

  const hasReconnectedHandler = onReconnected !== undefined;
  useEffect(() => {
    if (!realtime || !hasReconnectedHandler) return;
    return realtime.subscribeReconnected(() => onReconnectedRef.current?.());
  }, [realtime, hasReconnectedHandler]);
}

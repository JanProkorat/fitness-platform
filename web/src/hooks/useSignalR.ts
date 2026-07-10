import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  HubConnectionBuilder,
  HubConnection,
  LogLevel,
  HubConnectionState,
} from '@microsoft/signalr';
import { useAuthStore } from '@/stores/auth';

let _connection: HubConnection | null = null;

/** Invoke a hub method on the current SignalR connection (fire-and-forget). */
export function invokeHub(method: string, ...args: unknown[]): void {
  if (_connection?.state === HubConnectionState.Connected) {
    _connection.invoke(method, ...args).catch(() => {});
  }
}

/**
 * Manages a SignalR connection to the notification hub.
 * Connects when the user is authenticated, disconnects on logout.
 *
 * @param handlers - Map of event names to callbacks. Stable references recommended.
 * @param onReconnected - Called after the SignalR client silently re-establishes
 *   its connection (transport downgrade, hub timeout, brief server restart —
 *   the browser's `navigator.onLine`/TanStack `refetchOnReconnect` never fires
 *   for these because the network itself never went down). Use this to
 *   invalidate queries that may have missed a broadcast during the gap;
 *   `useSignalR` never fetches data itself, only notifies. Stable reference
 *   recommended (same rule as `handlers`).
 */
export function useSignalR(
  handlers: Record<string, (payload: unknown) => void>,
  onReconnected?: () => void,
) {
  const connectionRef = useRef<HubConnection | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });
  const onReconnectedRef = useRef(onReconnected);
  useLayoutEffect(() => {
    onReconnectedRef.current = onReconnected;
  });
  /** Lowercased event keys registered on the connection by the handlers-update effect below. */
  const registeredKeysRef = useRef<Set<string>>(new Set());

  // Connect/disconnect based on auth state only (not token changes).
  // React 18 StrictMode runs effects twice (mount → cleanup → mount),
  // so we track cancellation to avoid "stopped during negotiation" errors.
  useEffect(() => {
    if (!isAuthenticated) {
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
        _connection = null;
      }
      return;
    }

    let cancelled = false;

    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/notifications', {
        accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    // SignalR JS client lowercases method names — register with lowercase
    // but dispatch to the original-cased handler
    for (const event of Object.keys(handlersRef.current)) {
      connection.on(event.toLowerCase(), (payload: unknown) => {
        handlersRef.current[event]?.(payload);
      });
    }

    connection.onreconnected(() => {
      console.log('[SignalR] Reconnected');
      onReconnectedRef.current?.();
    });

    // Start the connection. If cleanup runs mid-negotiation (React 18
    // StrictMode), we let start() finish and then stop — calling stop()
    // during negotiation triggers an internal SignalR error log.
    connection.start().then(() => {
      if (cancelled) {
        connection.stop();
        return;
      }
      connectionRef.current = connection;
      _connection = connection;
    }).catch((err) => {
      if (!cancelled) {
        console.warn('[SignalR] Connection failed:', err);
      }
    });

    return () => {
      cancelled = true;
      if (connectionRef.current === connection) {
        connectionRef.current = null;
        _connection = null;
      }
      // If already connected, stop immediately. If still negotiating,
      // the startPromise .then() will stop it once negotiation finishes.
      if (connection.state === HubConnectionState.Connected) {
        connection.stop();
      }
    };
  }, [isAuthenticated]);

  // Update handlers when they change. Diff against the previously-registered
  // keys so a handler removed between renders is off()'d instead of left
  // dangling on the connection (a stale closure would otherwise keep firing).
  useEffect(() => {
    const conn = connectionRef.current;
    if (!conn) return;

    const newKeys = new Set(Object.keys(handlers).map((event) => event.toLowerCase()));

    for (const key of registeredKeysRef.current) {
      if (!newKeys.has(key)) {
        conn.off(key);
      }
    }

    for (const event of Object.keys(handlers)) {
      const key = event.toLowerCase();
      conn.off(key);
      conn.on(key, (payload: unknown) => {
        handlersRef.current[event]?.(payload);
      });
    }

    registeredKeysRef.current = newKeys;
  }, [handlers]);
}

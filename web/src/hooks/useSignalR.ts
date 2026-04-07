import { useEffect, useRef } from 'react';
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
 */
export function useSignalR(handlers: Record<string, (payload: unknown) => void>) {
  const connectionRef = useRef<HubConnection | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Connect/disconnect based on auth state only (not token changes)
  useEffect(() => {
    if (!isAuthenticated) {
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
      return;
    }

    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/notifications', {
        accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    connectionRef.current = connection;
    _connection = connection;

    // SignalR JS client lowercases method names — register with lowercase
    // but dispatch to the original-cased handler
    for (const event of Object.keys(handlersRef.current)) {
      connection.on(event.toLowerCase(), (payload: unknown) => {
        handlersRef.current[event]?.(payload);
      });
    }

    connection.start().catch((err) => {
      console.warn('[SignalR] Connection failed:', err);
    });

    connection.onreconnected(() => {
      console.log('[SignalR] Reconnected');
    });

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        connection.stop();
      }
      connectionRef.current = null;
      _connection = null;
    };
  }, [isAuthenticated]);

  // Update handlers when they change
  useEffect(() => {
    const conn = connectionRef.current;
    if (!conn) return;

    for (const event of Object.keys(handlers)) {
      const key = event.toLowerCase();
      conn.off(key);
      conn.on(key, (payload: unknown) => {
        handlersRef.current[event]?.(payload);
      });
    }
  }, [handlers]);
}

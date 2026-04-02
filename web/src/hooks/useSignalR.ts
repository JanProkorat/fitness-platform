import { useEffect, useRef } from 'react';
import {
  HubConnectionBuilder,
  HubConnection,
  LogLevel,
  HubConnectionState,
} from '@microsoft/signalr';
import { useAuthStore } from '@/stores/auth';

/**
 * Manages a SignalR connection to the notification hub.
 * Connects when the user is authenticated, disconnects on logout.
 *
 * @param handlers - Map of event names to callbacks. Stable references recommended.
 */
export function useSignalR(handlers: Record<string, (payload: unknown) => void>) {
  const connectionRef = useRef<HubConnection | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      // Disconnect if we were connected
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

    // Register all event handlers
    const eventNames = Object.keys(handlersRef.current);
    for (const event of eventNames) {
      connection.on(event, (payload: unknown) => {
        handlersRef.current[event]?.(payload);
      });
    }

    connection.start().catch((err) => {
      console.warn('[SignalR] Connection failed:', err);
    });

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        connection.stop();
      }
      connectionRef.current = null;
    };
  }, [isAuthenticated, accessToken]);

  // Update handlers when they change (new events added)
  useEffect(() => {
    const conn = connectionRef.current;
    if (!conn) return;

    const eventNames = Object.keys(handlers);
    for (const event of eventNames) {
      conn.off(event);
      conn.on(event, (payload: unknown) => {
        handlersRef.current[event]?.(payload);
      });
    }
  }, [handlers]);
}

import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import type { HubConnection } from '@microsoft/signalr';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { API_BASE_URL } from '@/lib/config';
import { useAuthStore } from '@/stores/auth';

import { RealtimeContext } from './context';
import type { RealtimeApi, RealtimeHandler } from './context';
import { hubLogger } from './hubLogger';
import { getHubAccessToken } from './token';

const HUB_PATH = '/hubs/notifications';
/** Back-off before each automatic reconnect attempt; after the last one the connection stays closed. */
const RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000, 30000];
/** Back-off for restarting the connection once automatic reconnect has given up. */
const RESTART_INITIAL_DELAY_MS = 2000;
const RESTART_MAX_DELAY_MS = 30000;

type RealtimeProviderProps = {
  /** True while the signed-in client is on the home screens; the connection exists only then. */
  enabled: boolean;
  children: ReactNode;
};

/**
 * Owns the one app-wide SignalR connection. It opens while `enabled`, closes when the user
 * signs out, and fans hub events out to `useRealtimeEvent` subscribers.
 */
export function RealtimeProvider({ enabled, children }: RealtimeProviderProps) {
  const sessionGeneration = useAuthStore((state) => state.sessionGeneration);
  const handlers = useRef(new Map<string, Set<RealtimeHandler>>());
  const reconnectCallbacks = useRef(new Set<() => void>());
  const connectionRef = useRef<HubConnection | null>(null);
  const attached = useRef(new WeakMap<HubConnection, Set<string>>());

  const api = useMemo<RealtimeApi>(() => {
    const attach = (connection: HubConnection, event: string) => {
      const done = attached.current.get(connection) ?? new Set<string>();
      attached.current.set(connection, done);
      if (done.has(event)) return;
      done.add(event);
      connection.on(event, (payload: unknown) => {
        handlers.current.get(event)?.forEach((handler) => handler(payload));
      });
    };

    return {
      subscribe: (name, handler) => {
        const event = name.toLowerCase();
        const set = handlers.current.get(event) ?? new Set<RealtimeHandler>();
        set.add(handler);
        handlers.current.set(event, set);
        if (connectionRef.current) attach(connectionRef.current, event);
        return () => {
          set.delete(handler);
        };
      },
      subscribeReconnected: (callback) => {
        reconnectCallbacks.current.add(callback);
        return () => {
          reconnectCallbacks.current.delete(callback);
        };
      },
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}${HUB_PATH}`, { accessTokenFactory: getHubAccessToken })
      .withAutomaticReconnect(RECONNECT_DELAYS_MS)
      .configureLogging(hubLogger)
      .build();
    connectionRef.current = connection;

    const done = new Set<string>();
    attached.current.set(connection, done);
    handlers.current.forEach((_set, event) => {
      done.add(event);
      connection.on(event, (payload: unknown) => {
        handlers.current.get(event)?.forEach((handler) => handler(payload));
      });
    });

    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let starting = false;
    // Set once a start failed or the connection closed, so the next success refreshes the lists.
    let recovering = false;
    let delay = RESTART_INITIAL_DELAY_MS;

    const notifyReconnected = () => reconnectCallbacks.current.forEach((callback) => callback());
    connection.onreconnected(() => {
      recovering = false;
      notifyReconnected();
    });

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    // At most one pending timer; stops for good once the session has ended.
    const scheduleRestart = () => {
      if (closed || timer !== null || starting) return;
      if (!useAuthStore.getState().isAuthenticated) return;
      recovering = true;
      const wait = delay;
      delay = Math.min(delay * 2, RESTART_MAX_DELAY_MS);
      timer = setTimeout(() => {
        timer = null;
        void startConnection();
      }, wait);
    };

    // Restarts the same connection object, so handlers and the attached WeakMap stay valid.
    const startConnection = async () => {
      if (closed || starting || connection.state !== HubConnectionState.Disconnected) return;
      starting = true;
      try {
        await connection.start();
      } catch (error: unknown) {
        starting = false;
        if (closed) return;
        console.warn('Realtime connection failed to start', error);
        scheduleRestart();
        return;
      }
      starting = false;
      if (closed) return;
      delay = RESTART_INITIAL_DELAY_MS;
      if (recovering) {
        recovering = false;
        notifyReconnected();
      }
    };

    // Automatic reconnect gave up: keep restarting with a capped back-off.
    connection.onclose(() => {
      if (closed) return;
      console.warn('Realtime connection closed, restarting');
      scheduleRestart();
    });

    void startConnection();

    // Returning to the foreground skips any pending back-off and starts immediately.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || connection.state !== HubConnectionState.Disconnected) return;
      if (!useAuthStore.getState().isAuthenticated) return;
      clearTimer();
      void startConnection();
    });

    return () => {
      closed = true;
      clearTimer();
      subscription.remove();
      connectionRef.current = null;
      void connection.stop().catch(() => undefined);
    };
  }, [enabled, sessionGeneration]);

  return <RealtimeContext.Provider value={api}>{children}</RealtimeContext.Provider>;
}

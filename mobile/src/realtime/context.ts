import { createContext } from 'react';

export type RealtimeHandler = (payload: unknown) => void;

/** What the app-wide hub connection offers to components. */
export type RealtimeApi = {
  /** Registers a handler for a hub event (any casing). Returns the unsubscribe function. */
  subscribe: (event: string, handler: RealtimeHandler) => () => void;
  /** Registers a callback fired when the connection comes back after a gap. */
  subscribeReconnected: (callback: () => void) => () => void;
};

export const RealtimeContext = createContext<RealtimeApi | null>(null);
